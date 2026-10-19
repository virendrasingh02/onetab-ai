import { getAccessToken, refreshSession } from '@org/api-client';
import type { Upload } from '@org/types';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths, UploadType } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { appConfig } from './config';
import {
  fetchBlob,
  saveBlob,
  uploadBinary,
  uploadMultipart,
  type DownloadDocument,
  type TransferResult,
} from './web-transfer';

/** react-native-web has no `expo-file-system` transfers; browsers use fetch. */
const isWeb = Platform.OS === 'web';

export interface PickedFile {
  uri: string;
  name: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  /** Web only: the picked bytes, which the browser already holds. */
  blob?: Blob;
}

export type PickSource = 'camera' | 'library' | 'document';

/**
 * Lets the person choose a file. Camera and photo-library permission are
 * requested only at the moment they are needed; a refusal resolves to null.
 */
export async function pickFile(source: PickSource): Promise<PickedFile | null> {
  if (source === 'document') {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
    });
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return null;
    return {
      uri: asset.uri,
      name: asset.name,
      mimeType: asset.mimeType ?? 'application/octet-stream',
      size: asset.size ?? asset.file?.size ?? sizeOnDisk(asset.uri),
      blob: asset.file,
    };
  }

  // Browsers ask for camera/photo access themselves, through the file input.
  const permission = isWeb
    ? { granted: true }
    : source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted)
    throw new Error(
      `Permission to use the ${source === 'camera' ? 'camera' : 'photo library'} was denied. You can allow it in Settings.`,
    );

  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 0.85,
  };
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  const asset = result.canceled ? null : result.assets[0];
  if (!asset) return null;
  const name = asset.fileName ?? `photo-${Date.now()}.jpg`;
  return {
    uri: asset.uri,
    name,
    mimeType: asset.mimeType ?? 'image/jpeg',
    size: asset.fileSize ?? asset.file?.size ?? sizeOnDisk(asset.uri),
    width: asset.width,
    height: asset.height,
    blob: asset.file,
  };
}

function sizeOnDisk(uri: string): number {
  return isWeb ? 0 : new File(uri).size;
}

/** The bytes of a picked file on web (a `blob:`/`data:` URI as a fallback). */
async function blobOf(file: PickedFile): Promise<Blob> {
  return file.blob ?? (await fetch(file.uri)).blob();
}

/**
 * Runs a native transfer with the current access token, renewing it once on a
 * 401 — the same retry the axios interceptor gives JSON calls.
 */
async function withFreshToken<T extends { status: number }>(
  run: (token: string) => Promise<T>,
): Promise<T> {
  let token = getAccessToken() ?? (await refreshSession());
  let result = await run(token);
  if (result.status === 401) {
    token = await refreshSession();
    result = await run(token);
  }
  return result;
}

function apiUrl(path: string): string {
  return `${appConfig.apiUrl.replace(/\/+$/, '')}${path}`;
}

/**
 * Uploads to the workspace file store through the same endpoint the web
 * upload uses (`POST /workspaces/:id/uploads`), so plan caps, virus/size
 * checks and the Files hub all apply unchanged. Streams from disk natively
 * rather than reading the file into JS memory.
 */
export async function uploadToWorkspace(
  workspaceId: string,
  file: PickedFile,
  context: { channelId?: string; onProgress?: (percent: number) => void } = {},
): Promise<Upload> {
  const query = context.channelId
    ? `?channelId=${encodeURIComponent(context.channelId)}`
    : '';
  const url = apiUrl(`/workspaces/${workspaceId}/uploads${query}`);
  const result: TransferResult = await withFreshToken(async (token) =>
    isWeb
      ? uploadMultipart(fetch, url, await blobOf(file), {
          filename: file.name,
          headers: { Authorization: `Bearer ${token}` },
        })
      : new File(file.uri).upload(url, {
          httpMethod: 'POST',
          uploadType: UploadType.MULTIPART,
          fieldName: 'file',
          mimeType: file.mimeType,
          headers: { Authorization: `Bearer ${token}` },
          onProgress: context.onProgress
            ? ({ bytesSent, totalBytes }) => {
                if (totalBytes > 0)
                  context.onProgress?.(
                    Math.round((bytesSent / totalBytes) * 100),
                  );
              }
            : undefined,
        }),
  );
  const body = result.body
    ? (JSON.parse(result.body) as Record<string, unknown>)
    : {};
  if (result.status < 200 || result.status >= 300) {
    throw new Error(
      typeof body['message'] === 'string'
        ? body['message']
        : `Upload failed (${result.status}).`,
    );
  }
  return body as unknown as Upload;
}

/** Uploads raw bytes to the Matrix media repo and returns the `mxc://` URI. */
export async function uploadToMatrix(
  uploadUrl: string,
  authHeaders: Record<string, string>,
  file: PickedFile,
): Promise<string> {
  const result: TransferResult = isWeb
    ? await uploadBinary(fetch, uploadUrl, await blobOf(file), {
        mimeType: file.mimeType,
        headers: authHeaders,
      })
    : await new File(file.uri).upload(uploadUrl, {
        httpMethod: 'POST',
        uploadType: UploadType.BINARY_CONTENT,
        mimeType: file.mimeType,
        headers: { ...authHeaders, 'Content-Type': file.mimeType },
      });
  const body = result.body
    ? (JSON.parse(result.body) as { content_uri?: string; error?: string })
    : {};
  if (result.status >= 300 || !body.content_uri) {
    throw new Error(body.error ?? `Upload failed (${result.status}).`);
  }
  return body.content_uri;
}

function downloadsDirectory(): Directory {
  const dir = new Directory(Paths.cache, 'downloads');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

function safeName(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, '_').slice(0, 120) || 'file';
}

/**
 * Downloads to the app's cache and opens the system share sheet, from which
 * the person can save to Files/Drive or open it in another app. Nothing is
 * written outside the sandbox without their explicit choice.
 */
export async function downloadAndShare(
  url: string,
  filename: string,
  headers: Record<string, string>,
  mimeType?: string,
): Promise<void> {
  if (isWeb) {
    // The browser's download stands in for the share sheet.
    const blob = await fetchBlob(fetch, url, headers);
    const { document } = globalThis as unknown as {
      document: DownloadDocument;
    };
    saveBlob(document, URL, blob, safeName(filename));
    return;
  }
  const target = new File(downloadsDirectory(), safeName(filename));
  const file = await File.downloadFileAsync(url, target, {
    headers,
    idempotent: true,
  });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: filename });
  }
}

export async function downloadWorkspaceUpload(
  workspaceId: string,
  upload: Upload,
): Promise<void> {
  const token = getAccessToken() ?? (await refreshSession());
  await downloadAndShare(
    apiUrl(`/workspaces/${workspaceId}/uploads/${upload.id}/content`),
    upload.filename,
    { Authorization: `Bearer ${token}` },
    upload.mimeType,
  );
}

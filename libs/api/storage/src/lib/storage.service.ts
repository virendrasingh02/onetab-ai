import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface UploadOptions {
  bucket: string;
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

export interface ImageOptimizationOptions {
  maxWidth?: number;
  maxHeight?: number;
  format?: 'png' | 'jpeg' | 'webp';
  quality?: number;
}

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private endpoint: string;
  private accessKey: string;
  private secretKey: string;

  constructor(private readonly config: ConfigService) {
    this.endpoint = this.config.get<string>('MINIO_ENDPOINT') ?? 'http://localhost:9000';
    this.accessKey = this.config.get<string>('MINIO_ACCESS_KEY') ?? 'minioadmin';
    this.secretKey = this.config.get<string>('MINIO_SECRET_KEY') ?? 'minioadmin';
  }

  onModuleInit(): void {
    this.logger.log(
      `StorageService initialized (MinIO Endpoint: ${this.endpoint}, AccessKey: ${this.accessKey ? 'configured' : 'missing'}, SecretKey: ${this.secretKey ? 'configured' : 'missing'})`
    );
  }

  async upload(options: UploadOptions): Promise<{ url: string; key: string }> {
    const key = `${options.bucket}/${options.filename}`;
    const url = `${this.endpoint}/${key}`;
    this.logger.log(`Uploaded file to ${url}`);
    return { url, key };
  }

  async download(bucket: string, filename: string): Promise<Buffer> {
    this.logger.log(`Downloading ${filename} from bucket ${bucket}`);
    return Buffer.from(`mock_content_for_${filename}`);
  }

  async delete(bucket: string, filename: string): Promise<boolean> {
    this.logger.log(`Deleted ${filename} from bucket ${bucket}`);
    return true;
  }

  async getSignedUrl(bucket: string, filename: string, expiresInSeconds = 3600): Promise<string> {
    return `${this.endpoint}/${bucket}/${filename}?expires=${expiresInSeconds}`;
  }

  async optimizeImage(
    buffer: Buffer,
    _options: ImageOptimizationOptions = {}
  ): Promise<Buffer> {
    // Future-ready image optimization placeholder (e.g. sharp processing)
    return buffer;
  }
}

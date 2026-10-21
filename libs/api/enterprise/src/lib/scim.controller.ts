import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from '@org/api-common';
import type { Request, Response } from 'express';
import { ScimBearerGuard } from './scim-bearer.guard.js';
import { SCIMService, type SCIMGroupPayload, type SCIMUserPayload } from './scim.service.js';

@Controller({ path: 'scim/v2', version: '1' })
@Public()
@UseGuards(ScimBearerGuard)
export class ScimController {
  constructor(
    private readonly scimService: SCIMService,
    private readonly config: ConfigService,
  ) {}

  private getBaseUrl(req: Request): string {
    const raw =
      this.config.get<string>('API_URL') ||
      `${req.protocol}://${req.get('host')}/api/v1`;
    return `${raw.replace(/\/+$/, '')}/scim/v2`;
  }

  /* -------------------------------------------------------------------------- */
  /* RFC 7643 Discovery Endpoints                                               */
  /* -------------------------------------------------------------------------- */

  @Get('ServiceProviderConfig')
  getServiceProviderConfig(@Req() req: Request) {
    return this.scimService.getServiceProviderConfig(this.getBaseUrl(req));
  }

  @Get('Schemas')
  getSchemas(@Req() req: Request) {
    return this.scimService.getSchemas(this.getBaseUrl(req));
  }

  @Get('ResourceTypes')
  getResourceTypes(@Req() req: Request) {
    return this.scimService.getResourceTypes(this.getBaseUrl(req));
  }

  /* -------------------------------------------------------------------------- */
  /* Users Endpoints (RFC 7643 / RFC 7644)                                      */
  /* -------------------------------------------------------------------------- */

  @Get('Users')
  listUsers(
    @Req() req: any,
    @Query('filter') filter?: string,
    @Query('startIndex') startIndex?: string,
    @Query('count') count?: string,
  ) {
    return this.scimService.listUsers(
      req.scimOrganizationId,
      {
        filter,
        startIndex: startIndex ? parseInt(startIndex, 10) : undefined,
        count: count ? parseInt(count, 10) : undefined,
      },
      this.getBaseUrl(req),
    );
  }

  @Get('Users/:id')
  getUser(@Req() req: any, @Param('id') id: string) {
    return this.scimService.getUser(req.scimOrganizationId, id, this.getBaseUrl(req));
  }

  @Post('Users')
  async createUser(
    @Req() req: any,
    @Body() body: SCIMUserPayload,
    @Res({ passthrough: true }) res: Response,
  ) {
    const baseUrl = this.getBaseUrl(req);
    const user = await this.scimService.provisionUser(req.scimOrganizationId, body, baseUrl);
    res.status(HttpStatus.CREATED);
    res.setHeader('Location', `${baseUrl}/Users/${user.id}`);
    return user;
  }

  @Put('Users/:id')
  updateUser(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: SCIMUserPayload,
  ) {
    return this.scimService.updateUser(req.scimOrganizationId, id, body, this.getBaseUrl(req));
  }

  @Patch('Users/:id')
  patchUser(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.scimService.patchUser(req.scimOrganizationId, id, body, this.getBaseUrl(req));
  }

  @Delete('Users/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteUser(@Req() req: any, @Param('id') id: string) {
    await this.scimService.deprovisionUser(req.scimOrganizationId, id);
  }

  /* -------------------------------------------------------------------------- */
  /* Groups Endpoints (RFC 7643 / RFC 7644)                                     */
  /* -------------------------------------------------------------------------- */

  @Get('Groups')
  listGroups(
    @Req() req: any,
    @Query('filter') filter?: string,
    @Query('startIndex') startIndex?: string,
    @Query('count') count?: string,
  ) {
    return this.scimService.listGroups(
      req.scimOrganizationId,
      {
        filter,
        startIndex: startIndex ? parseInt(startIndex, 10) : undefined,
        count: count ? parseInt(count, 10) : undefined,
      },
      this.getBaseUrl(req),
    );
  }

  @Get('Groups/:id')
  getGroup(@Req() req: any, @Param('id') id: string) {
    return this.scimService.getGroup(req.scimOrganizationId, id, this.getBaseUrl(req));
  }

  @Post('Groups')
  async createGroup(
    @Req() req: any,
    @Body() body: SCIMGroupPayload,
    @Res({ passthrough: true }) res: Response,
  ) {
    const baseUrl = this.getBaseUrl(req);
    const group = await this.scimService.createGroup(req.scimOrganizationId, body, baseUrl);
    res.status(HttpStatus.CREATED);
    res.setHeader('Location', `${baseUrl}/Groups/${group.id}`);
    return group;
  }

  @Put('Groups/:id')
  updateGroup(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: SCIMGroupPayload,
  ) {
    return this.scimService.updateGroup(req.scimOrganizationId, id, body, this.getBaseUrl(req));
  }

  @Patch('Groups/:id')
  patchGroup(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.scimService.patchGroup(req.scimOrganizationId, id, body, this.getBaseUrl(req));
  }

  @Delete('Groups/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteGroup(@Req() req: any, @Param('id') id: string) {
    await this.scimService.deleteGroup(req.scimOrganizationId, id);
  }
}

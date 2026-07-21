import {
  AttachBiometricDto,
  BIOMETRIC_MAX_UPLOAD_BYTES,
  CurrentUser,
  Permission,
  Permissions,
  ProcessSoundwaveDto,
  type JwtPayload,
} from '@app/common';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  ApproveBiometricAssetDto,
  AssignBiometricAssetDto,
  ConfirmBiometricPlacementDto,
  ReprocessBiometricOptionsDto,
} from './biometric-gateway.dto';
import { BiometricService } from './biometric.service';
import {
  ApiAdminApproveBiometricAssetDocs,
  ApiAdminAssignBiometricAssetDocs,
  ApiAdminGetBiometricAssetDocs,
  ApiAdminGetFingerprintPresetsDocs,
  ApiAdminGetSoundwavePresetsDocs,
  ApiAdminProcessFingerprintDocs,
  ApiAdminProcessSoundwaveDocs,
  ApiAdminRegenerateBiometricTexturesDocs,
  ApiAdminReprocessBiometricAssetDocs,
  ApiAdminStoreHeartbeatDocs,
  ApiMeAttachEngravingBiometricDocs,
  ApiMeConfirmBiometricPlacementDocs,
  ApiMeGetBiometricViewerAssetsDocs,
  ApiMeListEngravingBiometricsDocs,
} from './biometric.swagger';

// Explicitly type the decorator factories to satisfy `@typescript-eslint/no-unsafe-call`
// (ESLint currently can't resolve the returned decorator type for these 2 new endpoints).
const ApiAdminGetFingerprintPresetsDocsTyped: () => MethodDecorator &
  ClassDecorator = ApiAdminGetFingerprintPresetsDocs;

const ApiAdminGetSoundwavePresetsDocsTyped: () => MethodDecorator &
  ClassDecorator = ApiAdminGetSoundwavePresetsDocs;

interface UploadedBiometricFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@ApiTags('Admin - Biometric Assets')
@ApiBearerAuth('access-token')
@Controller('api/v1/admin/biometric-assets')
export class AdminBiometricAssetsController {
  constructor(private readonly biometricService: BiometricService) {}

  @Post('fingerprint')
  @Permissions(Permission.OrderWrite)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: BIOMETRIC_MAX_UPLOAD_BYTES },
    }),
  )
  @ApiAdminProcessFingerprintDocs()
  processFingerprint(
    @UploadedFile() file: UploadedBiometricFile | undefined,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.biometricService.processFingerprint(user.sub, file);
  }

  @Get('fingerprint/presets')
  @Permissions(Permission.OrderWrite)
  @ApiAdminGetFingerprintPresetsDocsTyped()
  getFingerprintPresets() {
    return this.biometricService.getFingerprintPresets();
  }

  @Post('soundwave')
  @Permissions(Permission.OrderWrite)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: BIOMETRIC_MAX_UPLOAD_BYTES },
    }),
  )
  @ApiAdminProcessSoundwaveDocs()
  processSoundwave(
    @UploadedFile() file: UploadedBiometricFile | undefined,
    @Body() body: ProcessSoundwaveDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.biometricService.processSoundwave(
      user.sub,
      file,
      body.segmentStartMs,
      body.segmentDurationMs,
    );
  }

  @Get('soundwave/presets')
  @Permissions(Permission.OrderWrite)
  @ApiAdminGetSoundwavePresetsDocsTyped()
  getSoundwavePresets() {
    return this.biometricService.getSoundwavePresets();
  }

  @Post('heartbeat')
  @Permissions(Permission.OrderWrite)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: BIOMETRIC_MAX_UPLOAD_BYTES },
    }),
  )
  @ApiAdminStoreHeartbeatDocs()
  storeHeartbeat(
    @UploadedFile() file: UploadedBiometricFile | undefined,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.biometricService.storeHeartbeat(user.sub, file);
  }

  @Get(':assetId')
  @Permissions(Permission.OrderWrite)
  @ApiAdminGetBiometricAssetDocs()
  getAsset(@Param('assetId', ParseUUIDPipe) assetId: string) {
    return this.biometricService.getBiometricAsset(assetId);
  }

  @Post(':assetId/reprocess')
  @Permissions(Permission.OrderWrite)
  @ApiAdminReprocessBiometricAssetDocs()
  reprocess(
    @Param('assetId', ParseUUIDPipe) assetId: string,
    @Body() body: ReprocessBiometricOptionsDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.biometricService.reprocessBiometricAsset(assetId, user.sub, {
      ...body,
    });
  }

  @Post(':assetId/textures')
  @Permissions(Permission.OrderWrite)
  @ApiAdminRegenerateBiometricTexturesDocs()
  regenerateTextures(
    @Param('assetId', ParseUUIDPipe) assetId: string,
    @Body() body: ReprocessBiometricOptionsDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.biometricService.regenerateBiometricTextures(
      assetId,
      user.sub,
      { ...body },
    );
  }

  @Post(':assetId/approve')
  @Permissions(Permission.OrderWrite)
  @ApiAdminApproveBiometricAssetDocs()
  approve(
    @Param('assetId', ParseUUIDPipe) assetId: string,
    @Body() body: ApproveBiometricAssetDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.biometricService.approveBiometricAsset(assetId, user.sub, body);
  }

  @Post(':assetId/assign')
  @Permissions(Permission.OrderWrite)
  @ApiAdminAssignBiometricAssetDocs()
  assign(
    @Param('assetId', ParseUUIDPipe) assetId: string,
    @Body() body: AssignBiometricAssetDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.biometricService.assignBiometricAsset(assetId, user.sub, body);
  }
}

@ApiTags('Me - Biometric Assets')
@ApiBearerAuth('access-token')
@Controller('api/v1/me/biometric-assets')
export class MeBiometricAssetsController {
  constructor(private readonly biometricService: BiometricService) {}

  @Get(':assetId/viewer-assets')
  @ApiMeGetBiometricViewerAssetsDocs()
  getViewerAssets(
    @Param('assetId', ParseUUIDPipe) assetId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.biometricService.getUserBiometricViewerAssets(
      assetId,
      user.sub,
    );
  }

  @Post(':assetId/confirm-placement')
  @ApiMeConfirmBiometricPlacementDocs()
  confirmPlacement(
    @Param('assetId', ParseUUIDPipe) assetId: string,
    @Body() body: ConfirmBiometricPlacementDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.biometricService.confirmBiometricPlacement(
      assetId,
      user.sub,
      body,
    );
  }
}

@ApiTags('Me - Engraving Biometrics')
@ApiBearerAuth('access-token')
@Controller('api/v1/me/engravings')
export class MeEngravingBiometricsController {
  constructor(private readonly biometricService: BiometricService) {}

  @Get(':engravingId/biometrics')
  @ApiMeListEngravingBiometricsDocs()
  listBiometrics(
    @Param('engravingId', ParseUUIDPipe) engravingId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.biometricService.listEngravingBiometrics(user.sub, engravingId);
  }

  @Post(':engravingId/biometrics')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: BIOMETRIC_MAX_UPLOAD_BYTES },
    }),
  )
  @ApiMeAttachEngravingBiometricDocs()
  attachBiometric(
    @Param('engravingId', ParseUUIDPipe) engravingId: string,
    @UploadedFile() file: UploadedBiometricFile | undefined,
    @Body() body: AttachBiometricDto,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException(
        'file is required (multipart field "file")',
      );
    }
    return this.biometricService.attachEngravingBiometricAsUser(
      user.sub,
      engravingId,
      body.biometricType,
      file,
      body.extraData,
    );
  }
}

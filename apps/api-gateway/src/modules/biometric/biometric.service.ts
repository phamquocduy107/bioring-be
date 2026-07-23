import {
  BadRequestException,
  Inject,
  Injectable,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { Observable, lastValueFrom } from 'rxjs';

type BiometricAssetGrpcResponse = { assetJson: string };
type AttachBiometricGrpcResponse = { biometricJson: string };
type ListBiometricsGrpcResponse = {
  biometrics: Array<{
    id: string;
    engravingId: string;
    biometricType: string;
    requiredChannel: string;
    biometricAssetId: string;
    rawFileUrl: string;
    processedSvgUrl: string;
    status: string;
    artifactId: string;
    extraDataJson: string;
  }>;
};

type BiometricPresetsGrpcResponse = { presetsJson: string };

type BiometricGrpcService = {
  processFingerprint(data: {
    fileContent: Buffer;
    filename: string;
    contentType: string;
    staffId: string;
  }): Observable<BiometricAssetGrpcResponse>;
  processSoundwave(data: {
    fileContent: Buffer;
    filename: string;
    contentType: string;
    staffId: string;
    segmentStartMs?: number;
    segmentDurationMs?: number;
  }): Observable<BiometricAssetGrpcResponse>;
  storeHeartbeat(data: {
    fileContent: Buffer;
    filename: string;
    contentType: string;
    staffId: string;
  }): Observable<BiometricAssetGrpcResponse>;
  getBiometricAsset(data: {
    assetId: string;
  }): Observable<BiometricAssetGrpcResponse>;
  reprocessBiometricAsset(data: {
    assetId: string;
    staffId: string;
    optionsJson?: string;
  }): Observable<BiometricAssetGrpcResponse>;
  regenerateBiometricTextures(data: {
    assetId: string;
    staffId: string;
    optionsJson?: string;
  }): Observable<BiometricAssetGrpcResponse>;
  approveBiometricAsset(data: {
    assetId: string;
    staffId: string;
    note?: string;
    copyDebugFiles?: boolean;
  }): Observable<BiometricAssetGrpcResponse>;
  assignBiometricAsset(data: {
    assetId: string;
    staffId: string;
    engravingId: string;
    userId?: string;
  }): Observable<BiometricAssetGrpcResponse>;
  getUserBiometricViewerAssets(data: {
    assetId: string;
    userId: string;
  }): Observable<BiometricAssetGrpcResponse>;
  confirmBiometricPlacement(data: {
    assetId: string;
    userId: string;
    placementJson: string;
  }): Observable<BiometricAssetGrpcResponse>;
  attachEngravingBiometric(data: {
    engravingId: string;
    biometricType: string;
    fileContent: Buffer;
    filename: string;
    contentType: string;
    extraData?: string;
  }): Observable<AttachBiometricGrpcResponse>;
  attachEngravingBiometricAsUser(data: {
    engravingId: string;
    userId: string;
    biometricType: string;
    fileContent: Buffer;
    filename: string;
    contentType: string;
    extraData?: string;
  }): Observable<AttachBiometricGrpcResponse>;
  listEngravingBiometrics(data: {
    engravingId: string;
    userId: string;
  }): Observable<ListBiometricsGrpcResponse>;
  getFingerprintProcessingPresets(
    data: Record<string, never>,
  ): Observable<BiometricPresetsGrpcResponse>;
  getSoundwaveProcessingPresets(
    data: Record<string, never>,
  ): Observable<BiometricPresetsGrpcResponse>;
};

interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class BiometricService implements OnModuleInit {
  private biometricGrpcService?: BiometricGrpcService;

  constructor(
    @Optional()
    @Inject('BIOMETRIC_SERVICE')
    private readonly biometricClient?: ClientGrpc,
  ) {}

  onModuleInit() {
    this.biometricGrpcService =
      this.biometricClient?.getService<BiometricGrpcService>(
        'BiometricService',
      );
  }

  async getFingerprintPresets() {
    this.ensureGrpc();
    const response = await lastValueFrom(
      this.biometricGrpcService!.getFingerprintProcessingPresets({}),
    );
    return JSON.parse(response.presetsJson) as {
      presets: unknown[];
      parameterGuide: Record<string, string>;
    };
  }

  async getSoundwavePresets() {
    this.ensureGrpc();
    const response = await lastValueFrom(
      this.biometricGrpcService!.getSoundwaveProcessingPresets({}),
    );
    return JSON.parse(response.presetsJson) as {
      presets: unknown[];
      parameterGuide: Record<string, string>;
    };
  }

  async processFingerprint(staffId: string, file: UploadedFile | undefined) {
    this.ensureGrpc();
    this.assertImageFile(file);
    const response = await lastValueFrom(
      this.biometricGrpcService!.processFingerprint({
        fileContent: file!.buffer,
        filename: file!.originalname,
        contentType: file!.mimetype,
        staffId,
      }),
    );
    return { asset: this.parseAsset(response.assetJson) };
  }

  async processSoundwave(
    staffId: string,
    file: UploadedFile | undefined,
    segmentStartMs?: number,
    segmentDurationMs?: number,
  ) {
    this.ensureGrpc();
    this.assertAudioFile(file);
    const response = await lastValueFrom(
      this.biometricGrpcService!.processSoundwave({
        fileContent: file!.buffer,
        filename: file!.originalname,
        contentType: file!.mimetype,
        staffId,
        segmentStartMs: segmentStartMs ?? 0,
        segmentDurationMs: segmentDurationMs ?? 3000,
      }),
    );
    return { asset: this.parseAsset(response.assetJson) };
  }

  async storeHeartbeat(staffId: string, file: UploadedFile | undefined) {
    this.ensureGrpc();
    if (!file?.buffer?.length) {
      throw new BadRequestException('file is required');
    }
    const response = await lastValueFrom(
      this.biometricGrpcService!.storeHeartbeat({
        fileContent: file.buffer,
        filename: file.originalname,
        contentType: file.mimetype,
        staffId,
      }),
    );
    return { asset: this.parseAsset(response.assetJson) };
  }

  async getBiometricAsset(assetId: string) {
    this.ensureGrpc();
    const response = await lastValueFrom(
      this.biometricGrpcService!.getBiometricAsset({ assetId }),
    );
    return { asset: this.parseAsset(response.assetJson) };
  }

  async reprocessBiometricAsset(
    assetId: string,
    staffId: string,
    body: Record<string, unknown>,
  ) {
    this.ensureGrpc();
    const response = await lastValueFrom(
      this.biometricGrpcService!.reprocessBiometricAsset({
        assetId,
        staffId,
        optionsJson: JSON.stringify(body ?? {}),
      }),
    );
    return { asset: this.parseAsset(response.assetJson) };
  }

  async regenerateBiometricTextures(
    assetId: string,
    staffId: string,
    body: Record<string, unknown>,
  ) {
    this.ensureGrpc();
    const response = await lastValueFrom(
      this.biometricGrpcService!.regenerateBiometricTextures({
        assetId,
        staffId,
        optionsJson: JSON.stringify(body ?? {}),
      }),
    );
    return { asset: this.parseAsset(response.assetJson) };
  }

  async approveBiometricAsset(
    assetId: string,
    staffId: string,
    body: { note?: string; copyDebugFiles?: boolean },
  ) {
    this.ensureGrpc();
    const response = await lastValueFrom(
      this.biometricGrpcService!.approveBiometricAsset({
        assetId,
        staffId,
        note: body.note,
        copyDebugFiles: body.copyDebugFiles ?? false,
      }),
    );
    return { asset: this.parseAsset(response.assetJson) };
  }

  async assignBiometricAsset(
    assetId: string,
    staffId: string,
    body: {
      engravingId: string;
      userId?: string;
    },
  ) {
    this.ensureGrpc();
    const response = await lastValueFrom(
      this.biometricGrpcService!.assignBiometricAsset({
        assetId,
        staffId,
        engravingId: body.engravingId,
        userId: body.userId || '',
      }),
    );
    return { asset: this.parseAsset(response.assetJson) };
  }

  async getUserBiometricViewerAssets(assetId: string, userId: string) {
    this.ensureGrpc();
    const response = await lastValueFrom(
      this.biometricGrpcService!.getUserBiometricViewerAssets({
        assetId,
        userId,
      }),
    );
    return { asset: this.parseAsset(response.assetJson) };
  }

  async confirmBiometricPlacement(
    assetId: string,
    userId: string,
    body: {
      modelCode: string;
      surface: string;
      placement: Record<string, unknown>;
    },
  ) {
    this.ensureGrpc();
    const response = await lastValueFrom(
      this.biometricGrpcService!.confirmBiometricPlacement({
        assetId,
        userId,
        placementJson: JSON.stringify({ ...body, confirmedBy: 'customer' }),
      }),
    );
    return { asset: this.parseAsset(response.assetJson) };
  }

  async attachEngravingBiometricAsUser(
    userId: string,
    engravingId: string,
    biometricType: string,
    file: UploadedFile,
    extraData?: string,
  ) {
    this.ensureGrpc();
    const response = await lastValueFrom(
      this.biometricGrpcService!.attachEngravingBiometricAsUser({
        engravingId,
        userId,
        biometricType,
        fileContent: file.buffer,
        filename: file.originalname || 'upload.bin',
        contentType: file.mimetype || 'application/octet-stream',
        extraData,
      }),
    );
    return {
      biometric: JSON.parse(response.biometricJson) as Record<string, unknown>,
    };
  }

  async listEngravingBiometrics(userId: string, engravingId: string) {
    this.ensureGrpc();
    const response = await lastValueFrom(
      this.biometricGrpcService!.listEngravingBiometrics({
        engravingId,
        userId,
      }),
    );
    return {
      biometrics: response.biometrics.map((b) => ({
        ...b,
        extraData: JSON.parse(b.extraDataJson || '{}') as Record<
          string,
          unknown
        >,
      })),
    };
  }

  // Legacy aliases used by existing controllers
  async reprocessFingerprint(
    assetId: string,
    staffId: string,
    body: Record<string, unknown>,
  ) {
    return this.reprocessBiometricAsset(assetId, staffId, body);
  }

  async regenerateFingerprintTextures(
    assetId: string,
    staffId: string,
    body: Record<string, unknown>,
  ) {
    return this.regenerateBiometricTextures(assetId, staffId, body);
  }

  async approveFingerprintAsset(
    assetId: string,
    staffId: string,
    body: { note?: string; copyDebugFiles?: boolean },
  ) {
    return this.approveBiometricAsset(assetId, staffId, body);
  }

  async assignFingerprintAsset(
    assetId: string,
    staffId: string,
    body: {
      engravingId: string;
      userId?: string;
    },
  ) {
    return this.assignBiometricAsset(assetId, staffId, body);
  }

  async getUserFingerprintViewerAssets(assetId: string, userId: string) {
    return this.getUserBiometricViewerAssets(assetId, userId);
  }

  async confirmFingerprintPlacement(
    assetId: string,
    userId: string,
    body: {
      modelCode: string;
      surface: string;
      placement: Record<string, unknown>;
    },
  ) {
    return this.confirmBiometricPlacement(assetId, userId, body);
  }

  private ensureGrpc(): void {
    if (!this.biometricGrpcService) {
      throw new BadRequestException('BIOMETRIC_SERVICE is not available');
    }
  }

  private assertImageFile(file: UploadedFile | undefined): void {
    if (!file?.buffer?.length) {
      throw new BadRequestException('file is required');
    }
    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.mimetype)) {
      throw new BadRequestException('Only image/png or image/jpeg are allowed');
    }
  }

  private assertAudioFile(file: UploadedFile | undefined): void {
    if (!file?.buffer?.length) {
      throw new BadRequestException('file is required');
    }
    const ok =
      file.mimetype.startsWith('audio/') ||
      file.mimetype === 'application/octet-stream';
    if (!ok) {
      throw new BadRequestException('Only audio files are allowed');
    }
  }

  private parseAsset(assetJson: string): Record<string, unknown> {
    return JSON.parse(assetJson) as Record<string, unknown>;
  }
}

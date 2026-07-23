import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { SkipTimeout } from '@app/common';
import { BiometricAssetService } from './biometric-asset.service';

function toFile(data: {
  fileContent: Buffer | Uint8Array;
  filename: string;
  contentType: string;
}) {
  return {
    buffer: Buffer.from(data.fileContent),
    originalname: data.filename,
    mimetype: data.contentType,
  };
}

function assetJson(result: { asset: unknown }) {
  return { assetJson: JSON.stringify(result.asset) };
}

function presetsJson(result: unknown) {
  return { presetsJson: JSON.stringify(result) };
}

@Controller()
export class BiometricAssetController {
  constructor(private readonly assets: BiometricAssetService) {}

  @GrpcMethod('BiometricService', 'GetFingerprintProcessingPresets')
  async getFingerprintProcessingPresets() {
    return presetsJson(await this.assets.getFingerprintPresets());
  }

  @GrpcMethod('BiometricService', 'GetSoundwaveProcessingPresets')
  async getSoundwaveProcessingPresets() {
    return presetsJson(await this.assets.getSoundwavePresets());
  }

  @SkipTimeout()
  @GrpcMethod('BiometricService', 'ProcessAudio')
  async processAudio(data: { audioUrl: string; engravingVersionId: string }) {
    return this.assets.processAudio(data.audioUrl, data.engravingVersionId);
  }

  @SkipTimeout()
  @GrpcMethod('BiometricService', 'ProcessFingerprint')
  async processFingerprint(data: {
    fileContent: Buffer;
    filename: string;
    contentType: string;
    staffId: string;
  }) {
    return assetJson(
      await this.assets.processFingerprint({
        staffId: data.staffId,
        file: toFile(data),
      }),
    );
  }

  @SkipTimeout()
  @GrpcMethod('BiometricService', 'ProcessSoundwave')
  async processSoundwave(data: {
    fileContent: Buffer;
    filename: string;
    contentType: string;
    staffId: string;
    segmentStartMs?: number;
    segmentDurationMs?: number;
  }) {
    return assetJson(
      await this.assets.processSoundwave({
        staffId: data.staffId,
        file: toFile(data),
        segmentStartMs: data.segmentStartMs,
        segmentDurationMs: data.segmentDurationMs,
      }),
    );
  }

  @SkipTimeout()
  @GrpcMethod('BiometricService', 'StoreHeartbeat')
  async storeHeartbeat(data: {
    fileContent: Buffer;
    filename: string;
    contentType: string;
    staffId: string;
  }) {
    return assetJson(
      await this.assets.storeHeartbeat({
        staffId: data.staffId,
        file: toFile(data),
      }),
    );
  }

  @GrpcMethod('BiometricService', 'GetBiometricAsset')
  async getBiometricAsset(data: { assetId: string }) {
    return assetJson(await this.assets.getAsset(data.assetId));
  }

  @SkipTimeout()
  @GrpcMethod('BiometricService', 'ReprocessBiometricAsset')
  async reprocessBiometricAsset(data: {
    assetId: string;
    staffId: string;
    optionsJson?: string;
  }) {
    return assetJson(await this.assets.reprocess(data));
  }

  @SkipTimeout()
  @GrpcMethod('BiometricService', 'ReprocessFingerprint')
  async reprocessFingerprint(data: {
    assetId: string;
    staffId: string;
    optionsJson?: string;
  }) {
    return assetJson(await this.assets.reprocess(data));
  }

  @SkipTimeout()
  @GrpcMethod('BiometricService', 'ReprocessSoundwave')
  async reprocessSoundwave(data: {
    assetId: string;
    staffId: string;
    optionsJson?: string;
  }) {
    return assetJson(await this.assets.reprocess(data));
  }

  @SkipTimeout()
  @GrpcMethod('BiometricService', 'RegenerateBiometricTextures')
  async regenerateBiometricTextures(data: {
    assetId: string;
    staffId: string;
    optionsJson?: string;
  }) {
    return assetJson(await this.assets.regenerateTextures(data));
  }

  @SkipTimeout()
  @GrpcMethod('BiometricService', 'RegenerateFingerprintTextures')
  async regenerateFingerprintTextures(data: {
    assetId: string;
    staffId: string;
    optionsJson?: string;
  }) {
    return assetJson(await this.assets.regenerateTextures(data));
  }

  @SkipTimeout()
  @GrpcMethod('BiometricService', 'RegenerateSoundwaveTextures')
  async regenerateSoundwaveTextures(data: {
    assetId: string;
    staffId: string;
    optionsJson?: string;
  }) {
    return assetJson(await this.assets.regenerateTextures(data));
  }

  @SkipTimeout()
  @GrpcMethod('BiometricService', 'ApproveBiometricAsset')
  async approveBiometricAsset(data: {
    assetId: string;
    staffId: string;
    note?: string;
    copyDebugFiles?: boolean;
  }) {
    return assetJson(await this.assets.approve(data));
  }

  @SkipTimeout()
  @GrpcMethod('BiometricService', 'ApproveFingerprintAsset')
  async approveFingerprintAsset(data: {
    assetId: string;
    staffId: string;
    note?: string;
    copyDebugFiles?: boolean;
  }) {
    return assetJson(await this.assets.approve(data));
  }

  @SkipTimeout()
  @GrpcMethod('BiometricService', 'ApproveSoundwaveAsset')
  async approveSoundwaveAsset(data: {
    assetId: string;
    staffId: string;
    note?: string;
    copyDebugFiles?: boolean;
  }) {
    return assetJson(await this.assets.approve(data));
  }

  @GrpcMethod('BiometricService', 'AssignBiometricAsset')
  async assignBiometricAsset(data: {
    assetId: string;
    staffId: string;
    engravingId: string;
    userId?: string;
  }) {
    return assetJson(await this.assets.assign(data));
  }

  @GrpcMethod('BiometricService', 'AssignFingerprintAsset')
  async assignFingerprintAsset(data: {
    assetId: string;
    staffId: string;
    engravingId: string;
    userId?: string;
  }) {
    return assetJson(await this.assets.assign(data));
  }

  @GrpcMethod('BiometricService', 'AssignSoundwaveAsset')
  async assignSoundwaveAsset(data: {
    assetId: string;
    staffId: string;
    engravingId: string;
    userId?: string;
  }) {
    return assetJson(await this.assets.assign(data));
  }

  @GrpcMethod('BiometricService', 'AssignHeartbeatAsset')
  async assignHeartbeatAsset(data: {
    assetId: string;
    staffId: string;
    engravingId: string;
    userId?: string;
  }) {
    return assetJson(await this.assets.assign(data));
  }

  @GrpcMethod('BiometricService', 'GetUserBiometricViewerAssets')
  async getUserBiometricViewerAssets(data: {
    assetId: string;
    userId: string;
  }) {
    return assetJson(await this.assets.getUserViewerAssets(data));
  }

  @GrpcMethod('BiometricService', 'GetUserFingerprintViewerAssets')
  async getUserFingerprintViewerAssets(data: {
    assetId: string;
    userId: string;
  }) {
    return assetJson(await this.assets.getUserViewerAssets(data));
  }

  @GrpcMethod('BiometricService', 'GetUserSoundwaveViewerAssets')
  async getUserSoundwaveViewerAssets(data: {
    assetId: string;
    userId: string;
  }) {
    return assetJson(await this.assets.getUserViewerAssets(data));
  }

  @GrpcMethod('BiometricService', 'ConfirmBiometricPlacement')
  async confirmBiometricPlacement(data: {
    assetId: string;
    userId: string;
    placementJson: string;
  }) {
    return assetJson(await this.assets.confirmPlacement(data));
  }

  @GrpcMethod('BiometricService', 'ConfirmFingerprintPlacement')
  async confirmFingerprintPlacement(data: {
    assetId: string;
    userId: string;
    placementJson: string;
  }) {
    return assetJson(await this.assets.confirmPlacement(data));
  }

  @GrpcMethod('BiometricService', 'ConfirmSoundwavePlacement')
  async confirmSoundwavePlacement(data: {
    assetId: string;
    userId: string;
    placementJson: string;
  }) {
    return assetJson(await this.assets.confirmPlacement(data));
  }
}

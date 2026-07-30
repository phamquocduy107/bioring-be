import { Controller } from '@nestjs/common';

import { GrpcMethod } from '@nestjs/microservices';

import { SkipTimeout } from '@app/common';

import { AttachBiometricService } from './attach-biometric.service';

@Controller()
export class AttachBiometricController {
  constructor(private readonly attachService: AttachBiometricService) {}

  @SkipTimeout()
  @GrpcMethod('BiometricService', 'AttachEngravingBiometric')
  async attachEngravingBiometric(data: {
    engravingId: string;

    biometricType: string;

    fileContent: Buffer | Uint8Array;

    filename?: string;

    contentType?: string;

    extraData?: string;
  }) {
    const result = await this.attachService.attach({
      engravingId: data.engravingId,

      biometricType: data.biometricType,

      fileContent: data.fileContent,

      filename: data.filename,

      contentType: data.contentType,

      extraData: data.extraData,
    });

    return { biometricJson: JSON.stringify(result.biometric) };
  }

  @SkipTimeout()
  @GrpcMethod('BiometricService', 'AttachEngravingBiometricAsUser')
  async attachEngravingBiometricAsUser(data: {
    engravingId: string;

    userId: string;

    biometricType: string;

    fileContent: Buffer | Uint8Array;

    filename?: string;

    contentType?: string;

    extraData?: string;
  }) {
    const result = await this.attachService.attachAsUser({
      engravingId: data.engravingId,

      userId: data.userId,

      biometricType: data.biometricType,

      fileContent: data.fileContent,

      filename: data.filename,

      contentType: data.contentType,

      extraData: data.extraData,
    });

    return { biometricJson: JSON.stringify(result.biometric) };
  }

  @GrpcMethod('BiometricService', 'ListEngravingBiometrics')
  async listEngravingBiometrics(data: {
    engravingId: string;

    userId: string;
  }) {
    const result = await this.attachService.listForEngraving(
      data.engravingId,

      data.userId,
    );

    return {
      biometrics: result.biometrics.map((b) => ({
        id: b.id,

        engravingId: b.engravingId,

        biometricType: b.biometricType,

        requiredChannel: b.requiredChannel,

        biometricAssetId: b.biometricAssetId,

        rawFileUrl: b.rawFileUrl,

        processedSvgUrl: b.processedSvgUrl,

        status: b.status,

        artifactId: b.artifactId,
      })),
    };
  }
}

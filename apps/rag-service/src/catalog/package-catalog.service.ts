import { Injectable, Logger } from '@nestjs/common';
import type { PackageCandidate } from './catalog.types';

@Injectable()
export class PackageCatalogService {
  private readonly logger = new Logger(PackageCatalogService.name);

  /**
   * TODO: wire to package DB/service when package catalog is available.
   * Currently `orders.package_type` is order metadata, not a browsable catalog.
   */
  async searchPackages(
    filters?: Record<string, unknown>,
  ): Promise<PackageCandidate[]> {
    void filters;
    this.logger.debug(
      'Package catalog not available yet — returning empty candidates',
    );
    return [];
  }
}

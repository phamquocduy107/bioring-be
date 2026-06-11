import { Injectable } from '@nestjs/common';

type PermissionResolver =
  | ((userId: string) => string[] | Promise<string[]>)
  | undefined;

@Injectable()
export class RbacService {
  private permissionResolver: PermissionResolver;

  // Allow each app to plug in its own permission source (DB, cache, API, etc.).
  setPermissionResolver(resolver: PermissionResolver): void {
    this.permissionResolver = resolver;
  }

  async getPermissionsByUserId(
    userId: string,
  ): Promise<Array<{ slug: string }>> {
    if (!this.permissionResolver) {
      return [];
    }

    const permissions = await this.permissionResolver(userId);
    return permissions.map((slug) => ({ slug }));
  }
}

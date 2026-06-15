import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY, IS_PUBLIC_KEY } from '../decorators';
import { RbacService } from '../rbac/rbac.service';

@Injectable()
export class PermissionRbacGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rbacService: RbacService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<{ user?: { sub: string } }>();
    const user = request.user;
    if (!user?.sub) {
      throw new UnauthorizedException('No authenticated user');
    }

    const userPermissions = await this.rbacService.getPermissionsByUserId(
      user.sub,
    );

    const granted = new Set(
      userPermissions.map((permission) => permission.slug),
    );
    const hasPermission = requiredPermissions.some((permission) =>
      granted.has(permission),
    );

    if (!hasPermission) {
      throw new UnauthorizedException('Insufficient permissions');
    }

    return true;
  }
}

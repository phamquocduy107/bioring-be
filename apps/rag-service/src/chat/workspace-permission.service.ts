import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@app/prisma';

@Injectable()
export class WorkspacePermissionService {
  private readonly logger = new Logger(WorkspacePermissionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Knowledge workspace is currently a shared catalog id (env), not a RBAC resource.
   * TODO: wire to identity/workspace membership when multi-tenant workspaces exist.
   */
  async assertUserCanAccessWorkspace(userId: string, workspaceId: string) {
    if (!userId?.trim() || !workspaceId?.trim()) {
      throw new ForbiddenException('Workspace access denied');
    }
    this.logger.debug(
      `TODO workspace RBAC: allowing user=${userId} workspace=${workspaceId}`,
    );
  }

  async assertUserCanAccessDocuments(
    userId: string,
    workspaceId: string,
    documentIds: string[],
  ) {
    if (!documentIds.length) {
      return;
    }

    const documents = await this.prisma.knowledge_documents.findMany({
      where: {
        id: { in: documentIds },
        workspace_id: workspaceId,
      },
      select: { id: true, user_id: true },
    });

    if (documents.length !== documentIds.length) {
      throw new ForbiddenException('Document not found or not accessible.');
    }

    const unauthorized = documents.filter((doc) => doc.user_id !== userId);
    if (unauthorized.length) {
      throw new ForbiddenException('Document not found or not accessible.');
    }
  }
}

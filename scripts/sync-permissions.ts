import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Syncing permissions and roles...');

  // Define all permissions
  const permissions = [
    // User management
    { slug: 'user.read', description: 'View users' },
    { slug: 'user.write', description: 'Create/Update users' },
    { slug: 'user.block', description: 'Ban/Unban users' },

    // Role management
    { slug: 'role.read', description: 'View roles & permissions' },
    { slug: 'role.write', description: 'Create/Update/Delete roles & permissions' },

    // Product management
    { slug: 'product.read', description: 'View products' },
    { slug: 'product.write', description: 'Create/Update/Delete products' },

    // Order management
    { slug: 'order.read', description: 'View orders' },
    { slug: 'order.write', description: 'Create/Update/Delete orders' },

    // Dashboard
    { slug: 'dashboard.view', description: 'View dashboard & reports' },

    // Settings
    { slug: 'settings.read', description: 'View settings' },
    { slug: 'settings.write', description: 'Update settings' },
  ];

  // Upsert permissions
  const createdPermissions: Record<string, string> = {};
  for (const perm of permissions) {
    const created = await prisma.permissions.upsert({
      where: { slug: perm.slug },
      create: perm,
      update: perm,
    });
    createdPermissions[created.slug] = created.id;
    console.log(`  Permission: ${created.slug}`);
  }

  // Define roles with their permissions
  const roles = [
    {
      name: 'ADMIN',
      description: 'System administrator with full access',
      permissionSlugs: permissions.map((p) => p.slug),
    },
    {
      name: 'MANAGER',
      description: 'Store manager',
      permissionSlugs: [
        'user.read',
        'role.read',
        'product.read',
        'product.write',
        'order.read',
        'order.write',
        'dashboard.view',
        'settings.read',
      ],
    },
    {
      name: 'STORE_STAFF',
      description: 'Store staff',
      permissionSlugs: [
        'user.read',
        'product.read',
        'order.read',
        'order.write',
      ],
    },
    {
      name: 'JEWELER',
      description: 'Jeweler / production staff',
      permissionSlugs: [
        'order.read',
        'product.read',
      ],
    },
    {
      name: 'DELIVERY_STAFF',
      description: 'Delivery staff',
      permissionSlugs: [
        'order.read',
      ],
    },
    {
      name: 'CUSTOMER',
      description: 'Regular customer',
      permissionSlugs: [
        'product.read',
        'order.read',
      ],
    },
  ];

  // Upsert roles and assign permissions
  for (const roleData of roles) {
    const role = await prisma.roles.upsert({
      where: { name: roleData.name },
      create: {
        name: roleData.name,
        description: roleData.description,
      },
      update: {
        description: roleData.description,
      },
    });

    console.log(`  Role: ${role.name}`);

    // Assign permissions to role
    const permissionIds = roleData.permissionSlugs
      .map((slug) => createdPermissions[slug])
      .filter(Boolean);

    if (permissionIds.length > 0) {
      // Remove old permissions that are not in the new list
      await prisma.role_permissions.deleteMany({
        where: {
          role_id: role.id,
          permission_id: {
            notIn: permissionIds,
          },
        },
      });

      // Add new permissions
      for (const permissionId of permissionIds) {
        await prisma.role_permissions.upsert({
          where: {
            role_id_permission_id: {
              role_id: role.id,
              permission_id: permissionId,
            },
          },
          create: {
            role_id: role.id,
            permission_id: permissionId,
          },
          update: {},
        });
      }
    }
  }

  console.log('Sync completed successfully!');
}

main()
  .catch((e) => {
    console.error('Sync failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Materials
  const materials = await Promise.all([
    prisma.materials.create({
      data: {
        id: 'mat-gold-14k',
        name: 'Vàng 14K',
        purity: '58.5%',
        color: 'Vàng',
        current_price_per_gram: 1200000,
        stock_gram: 5000,
      },
    }),
    prisma.materials.create({
      data: {
        id: 'mat-gold-18k',
        name: 'Vàng 18K',
        purity: '75%',
        color: 'Vàng',
        current_price_per_gram: 1600000,
        stock_gram: 3000,
      },
    }),
    prisma.materials.create({
      data: {
        id: 'mat-white-gold-18k',
        name: 'Vàng trắng 18K',
        purity: '75%',
        color: 'Trắng',
        current_price_per_gram: 1800000,
        stock_gram: 2000,
      },
    }),
    prisma.materials.create({
      data: {
        id: 'mat-silver-925',
        name: 'Bạc 925',
        purity: '92.5%',
        color: 'Bạc',
        current_price_per_gram: 300000,
        stock_gram: 10000,
      },
    }),
    prisma.materials.create({
      data: {
        id: 'mat-platinum',
        name: 'Platinum',
        purity: '95%',
        color: 'Trắng bạch kim',
        current_price_per_gram: 2500000,
        stock_gram: 1000,
      },
    }),
  ]);

  console.log(`Created ${materials.length} materials`);

  // Gemstones
  const gemstones = await Promise.all([
    prisma.gemstones.create({
      data: {
        id: 'gms-diamond-05',
        type: 'Kim cương',
        carat: 0.5,
        cut: 'Round Brilliant',
        color: 'D',
        clarity: 'VS1',
        certification_code: 'GIA-123456',
        price: 15000000,
        stock_quantity: 50,
        is_available: true,
      },
    }),
    prisma.gemstones.create({
      data: {
        id: 'gms-diamond-1',
        type: 'Kim cương',
        carat: 1.0,
        cut: 'Round Brilliant',
        color: 'E',
        clarity: 'VS2',
        certification_code: 'GIA-123457',
        price: 35000000,
        stock_quantity: 30,
        is_available: true,
      },
    }),
    prisma.gemstones.create({
      data: {
        id: 'gms-sapphire-blue',
        type: 'Sapphire',
        carat: 1.2,
        cut: 'Oval',
        color: 'Xanh hoàng gia',
        clarity: 'VVS1',
        certification_code: 'GIA-123458',
        price: 12000000,
        stock_quantity: 20,
        is_available: true,
      },
    }),
    prisma.gemstones.create({
      data: {
        id: 'gms-ruby-red',
        type: 'Ruby',
        carat: 0.8,
        cut: 'Cushion',
        color: 'Đỏ máu bồ câu',
        clarity: 'VVS2',
        certification_code: 'GIA-123459',
        price: 18000000,
        stock_quantity: 15,
        is_available: true,
      },
    }),
    prisma.gemstones.create({
      data: {
        id: 'gms-emerald',
        type: 'Emerald',
        carat: 1.0,
        cut: 'Emerald',
        color: 'Xanh lục',
        clarity: 'SI1',
        certification_code: 'GIA-123460',
        price: 14000000,
        stock_quantity: 10,
        is_available: true,
      },
    }),
    prisma.gemstones.create({
      data: {
        id: 'gms-moissanite',
        type: 'Moissanite',
        carat: 1.5,
        cut: 'Round Brilliant',
        color: 'D',
        clarity: 'VVS1',
        certification_code: 'GIA-123461',
        price: 5000000,
        stock_quantity: 100,
        is_available: true,
      },
    }),
  ]);

  console.log(`Created ${gemstones.length} gemstones`);

  // Products
  const products = [
    {
      id: 'prod-classic-band',
      name: 'Classic Band',
      description:
        'Nhẫn trơn cổ điển, phù hợp cho cả nam và nữ. Thiết kế tối giản, tinh tế.',
      base_material_id: 'mat-gold-18k',
      base_price: 5000000,
      thumbnail_url: 'https://cdn.bioring.com/placeholder/ring-default.png',
      model_3d_url: 'https://cdn.bioring.com/placeholder/ring-default.png',
    },
    {
      id: 'prod-elegance',
      name: 'Elegance',
      description:
        'Nhẫn thiết kế thanh lịch với đính đá quý ở trung tâm. Phù hợp cho tiệc cưới và sự kiện.',
      base_material_id: 'mat-white-gold-18k',
      base_price: 8000000,
      thumbnail_url: 'https://cdn.bioring.com/placeholder/ring-default.png',
      model_3d_url: 'https://cdn.bioring.com/placeholder/ring-default.png',
    },
    {
      id: 'prod-solitaire',
      name: 'Solitaire',
      description:
        'Nhẫn đính đá đơn, tôn vinh vẻ đẹp của viên kim cương trung tâm.',
      base_material_id: 'mat-platinum',
      base_price: 12000000,
      thumbnail_url: 'https://cdn.bioring.com/placeholder/ring-default.png',
      model_3d_url: 'https://cdn.bioring.com/placeholder/ring-default.png',
    },
    {
      id: 'prod-eternity',
      name: 'Eternity',
      description:
        'Nhẫn vĩnh cửu với dải đá quý chạy quanh thân nhẫn. Biểu tượng cho tình yêu vĩnh hằng.',
      base_material_id: 'mat-gold-14k',
      base_price: 15000000,
      thumbnail_url: 'https://cdn.bioring.com/placeholder/ring-default.png',
      model_3d_url: 'https://cdn.bioring.com/placeholder/ring-default.png',
    },
    {
      id: 'prod-modern-edge',
      name: 'Modern Edge',
      description:
        'Nhẫn phong cách hiện đại, đường nét sắc sảo. Phù hợp cho người yêu thích sự phá cách.',
      base_material_id: 'mat-silver-925',
      base_price: 2500000,
      thumbnail_url: 'https://cdn.bioring.com/placeholder/ring-default.png',
      model_3d_url: 'https://cdn.bioring.com/placeholder/ring-default.png',
    },
    {
      id: 'prod-vintage-rose',
      name: 'Vintage Rose',
      description:
        'Nhẫn phong cách cổ điển với họa tiết hoa hồng tinh xảo. Đính đá Ruby ở trung tâm.',
      base_material_id: 'mat-gold-18k',
      base_price: 10000000,
      thumbnail_url: 'https://cdn.bioring.com/placeholder/ring-default.png',
      model_3d_url: 'https://cdn.bioring.com/placeholder/ring-default.png',
    },
    {
      id: 'prod-sapphire-dream',
      name: 'Sapphire Dream',
      description:
        'Nhẫn Sapphire xanh hoàng gia sang trọng. Viền kim cương tinh tế.',
      base_material_id: 'mat-white-gold-18k',
      base_price: 18000000,
      thumbnail_url: 'https://cdn.bioring.com/placeholder/ring-default.png',
      model_3d_url: 'https://cdn.bioring.com/placeholder/ring-default.png',
    },
    {
      id: 'prod-minimalist',
      name: 'Minimalist',
      description:
        'Nhẫn thiết kế tối giản, mỏng nhẹ. Phù hợp cho người yêu thích sự đơn giản.',
      base_material_id: 'mat-silver-925',
      base_price: 1500000,
      thumbnail_url: 'https://cdn.bioring.com/placeholder/ring-default.png',
      model_3d_url: 'https://cdn.bioring.com/placeholder/ring-default.png',
    },
  ];

  for (const productData of products) {
    const product = await prisma.products.create({ data: productData });

    // Link all materials to each product
    for (const material of materials) {
      await prisma.product_materials.create({
        data: { product_id: product.id, material_id: material.id },
      });
    }

    // Link random gemstones to each product
    const productGemstones = gemstones.slice(
      0,
      Math.min(gemstones.length, Math.floor(Math.random() * 4) + 2),
    );
    for (const gemstone of productGemstones) {
      await prisma.product_gemstones.create({
        data: { product_id: product.id, gemstone_id: gemstone.id },
      });
    }
  }

  console.log(`Created ${products.length} products with material and gemstone links`);
  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

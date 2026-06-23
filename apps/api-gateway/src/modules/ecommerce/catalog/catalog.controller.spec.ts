import { Test, TestingModule } from '@nestjs/testing';
import { CatalogController } from './catalog.controller';

describe('CatalogController', () => {
  let controller: CatalogController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [CatalogController],
    }).compile();

    controller = app.get<CatalogController>(CatalogController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  OnModuleInit,
  Optional,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { Observable, lastValueFrom } from 'rxjs';
import { CurrentUser } from '@app/common';
import type { JwtPayload } from '@app/common';
import { CreateRingSizeDto, UpdateRingSizeDto } from './ring-size.dto';
import {
  ApiCreateRingSizeDocs,
  ApiDeleteRingSizeDocs,
  ApiListRingSizesDocs,
  ApiSetDefaultRingSizeDocs,
  ApiUpdateRingSizeDocs,
} from './ring-size.swagger';

interface EcommerceGrpcService {
  listRingSizes(data: { userId: string }): Observable<{ ringSizes: any[] }>;
  createRingSize(
    data: { userId: string } & Omit<CreateRingSizeDto, 'guideStepResult'> & { guideStepResult?: string },
  ): Observable<{ ringSize: any }>;
  updateRingSize(
    data: { id: string; userId: string } & Omit<UpdateRingSizeDto, 'guideStepResult'> & { guideStepResult?: string },
  ): Observable<{ ringSize: any }>;
  deleteRingSize(data: {
    id: string;
    userId: string;
  }): Observable<{ success: boolean }>;
  setDefaultRingSize(data: {
    id: string;
    userId: string;
  }): Observable<{ ringSize: any }>;
}

@Controller('api/v1/ring-sizes')
export class RingSizeController implements OnModuleInit {
  private grpc?: EcommerceGrpcService;

  constructor(
    @Optional()
    @Inject('ECOMMERCE_SERVICE')
    private readonly client?: ClientGrpc,
  ) {}

  onModuleInit() {
    this.grpc =
      this.client?.getService<EcommerceGrpcService>('EcommerceService');
  }

  private async call<T>(fn: () => Observable<T>): Promise<T> {
    if (!this.grpc)
      throw new Error('ECOMMERCE_SERVICE gRPC client not initialized');
    return lastValueFrom(fn());
  }

  @Get()
  @ApiListRingSizesDocs()
  list(@CurrentUser() user: JwtPayload) {
    return this.call(() => this.grpc!.listRingSizes({ userId: user.sub }));
  }

  @Post()
  @ApiCreateRingSizeDocs()
  create(@Body() body: CreateRingSizeDto, @CurrentUser() user: JwtPayload) {
    return this.call(() =>
      this.grpc!.createRingSize({
        ...body,
        userId: user.sub,
        guideStepResult: body.guideStepResult
          ? JSON.stringify(body.guideStepResult)
          : undefined,
      }),
    );
  }

  @Put(':id')
  @ApiUpdateRingSizeDocs()
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: UpdateRingSizeDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.call(() =>
      this.grpc!.updateRingSize({
        ...body,
        id,
        userId: user.sub,
        guideStepResult: body.guideStepResult
          ? JSON.stringify(body.guideStepResult)
          : undefined,
      }),
    );
  }

  @Delete(':id')
  @ApiDeleteRingSizeDocs()
  delete(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.call(() =>
      this.grpc!.deleteRingSize({
        id,
        userId: user.sub,
      }),
    );
  }

  @Patch(':id/default')
  @ApiSetDefaultRingSizeDocs()
  setDefault(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.call(() =>
      this.grpc!.setDefaultRingSize({
        id,
        userId: user.sub,
      }),
    );
  }
}

@Controller('api/v1/me/ring-sizes')
export class MeRingSizeController extends RingSizeController {}

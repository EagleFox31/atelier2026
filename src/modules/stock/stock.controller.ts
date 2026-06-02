import { Controller, Get, Post, Body, Query, Param, Patch } from '@nestjs/common';
import { StockService } from './stock.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CurrentUser, RequirePermission } from '../../decorators/auth.decorator';
import { garageWhere, requireGarageId } from '../../shared/garage/garage-scope';
import { CreateStockMovementDto, CreateASPDto, CreatePartDto, UpdatePartDto } from './dto/stock.dto';

@Controller('stock')
export class StockController {
  constructor(
    private readonly stockService: StockService,
    private readonly prisma: PrismaService,
  ) { }

  // ─── Catalogue des pièces ─────────────────────────────────────────────────

  @Get('parts')
  @RequirePermission('STK_VIEW')
  async listParts(
    @CurrentUser() user: { garageId?: string | null },
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('lowStock') lowStock?: string,
  ) {
    const g = requireGarageId(user.garageId);
    const where: any = { isActive: true, garageId: g };

    if (category) where.category = category;

    if (search) {
      where.OR = [
        { nameFr: { contains: search, mode: 'insensitive' } },
        { reference: { contains: search, mode: 'insensitive' } },
        { oemReference: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Filtre pièces sous le seuil critique — redirige vers la route dédiée
    if (lowStock === 'true') {
      return this.prisma.$queryRaw`
        SELECT id, reference, name_fr, qty_in_stock, qty_available, min_threshold, category, sale_price_xaf
        FROM parts_catalog
        WHERE qty_available <= min_threshold AND is_active = true AND garage_id = ${g}::uuid
        ORDER BY (qty_available - min_threshold) ASC
      `;
    }

    return this.prisma.partsCatalog.findMany({
      where,
      include: { supplier: true },
      orderBy: { nameFr: 'asc' },
    });
  }

  @Get('parts/low-stock')
  @RequirePermission('STK_VIEW')
  async getLowStockParts(@CurrentUser() user: { garageId?: string | null }) {
    const g = requireGarageId(user.garageId);
    return this.prisma.$queryRaw`
      SELECT id, reference, name_fr, qty_in_stock, qty_available, min_threshold, category
      FROM parts_catalog
      WHERE qty_available <= min_threshold AND is_active = true AND garage_id = ${g}::uuid
      ORDER BY (qty_available - min_threshold) ASC
    `;
  }

  @Get('movements')
  @RequirePermission('STK_VIEW')
  async listMovements(
    @CurrentUser() user: { garageId?: string | null },
    @Query('partId') partId?: string,
    @Query('serviceOrderId') serviceOrderId?: string,
  ) {
    const where: any = { ...garageWhere(user.garageId) };
    if (partId) where.partId = partId;
    if (serviceOrderId) where.serviceOrderId = serviceOrderId;

    return this.prisma.stockMovement.findMany({
      where,
      include: {
        part: true,
        performer: { select: { firstName: true, lastName: true } },
        serviceOrder: { select: { reference: true } },
      },
      orderBy: { performedAt: 'desc' },
      take: 100,
    });
  }

  // ─── Mouvements de stock ──────────────────────────────────────────────────

  @Post('movement')
  @RequirePermission('STK_CREATE')
  async applyMovement(
    @CurrentUser() user: any,
    @Body() body: CreateStockMovementDto,
  ) {
    return this.stockService.applyMovement({
      partId: body.partId,
      type: body.type,
      quantity: body.quantity,
      userId: user.id,
      serviceOrderId: body.serviceOrderId,
      referenceDoc: body.referenceDoc,
      unitPriceXaf: body.unitPriceXaf,
      garageId: user.garageId,
    });
  }

  // ─── ASP (Achat Sur Place) ────────────────────────────────────────────────

  @Post('asp')
  @RequirePermission('STK_CREATE')
  async recordASP(
    @CurrentUser() user: any,
    @Body() body: CreateASPDto,
  ) {
    return this.stockService.recordASP({
      partId: body.partId,
      serviceOrderId: body.serviceOrderId,
      quantity: body.quantity,
      purchasePrice: body.purchasePrice,
      salePrice: body.salePrice,
      userId: user.id,
      supplierName: body.supplierName,
      garageId: user.garageId,
    });
  }

  @Get('parts/:id')
  @RequirePermission('STK_VIEW')
  getPart(@CurrentUser() user: { garageId?: string | null }, @Param('id') id: string) {
    return this.stockService.getPart(id, user.garageId);
  }

  @Post('parts')
  @RequirePermission('STK_CREATE')
  async createPart(@CurrentUser() user: { garageId?: string | null }, @Body() body: CreatePartDto) {
    const g = requireGarageId(user.garageId);
    return this.prisma.partsCatalog.create({ data: { ...body, garageId: g } });
  }

  @Patch('parts/:id')
  @RequirePermission('STK_CREATE')
  async updatePart(
    @CurrentUser() user: { garageId?: string | null },
    @Param('id') id: string,
    @Body() body: UpdatePartDto,
  ) {
    await this.stockService.getPart(id, user.garageId);
    return this.prisma.partsCatalog.update({ where: { id }, data: body });
  }

  @Get('suppliers')
  @RequirePermission('STK_VIEW')
  async listSuppliers() {
    return this.prisma.supplier.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }
}

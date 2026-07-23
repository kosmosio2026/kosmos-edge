import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { PermissionGuard } from "../../../common/guards/permission.guard";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { PERMISSIONS } from "../../../common/rbac/permissions";
import { LotsService } from "./lots.service";
import { CreateParkingLotDto } from "./dto/create-parking-lot.dto";
import { UpdateParkingLotDto } from "./dto/update-parking-lot.dto";
import type { AuthUser } from "../../../common/types/auth-user.type";

@Controller("facilities/lots")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class LotsController {
  constructor(private readonly lotsService: LotsService) {}

  @Get()
  @RequirePermission(PERMISSIONS.PARKING_LOT_READ)
  findAll(
    @CurrentUser() user: AuthUser,
    @Query("status") status?: "active" | "inactive" | "all",
  ) {
    return this.lotsService.findAll(user, status);
  }

  @Get(":id")
  @RequirePermission(PERMISSIONS.PARKING_LOT_READ)
  findOne(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.lotsService.findOne(id, user);
  }

  @Post("validate-import")
  @RequirePermission(PERMISSIONS.PARKING_SECTION_WRITE)
  validateImport(
    @CurrentUser() user: AuthUser,
    @Body() body: { rows?: Record<string, unknown>[] },
  ) {
    return this.lotsService.validateImportRows(user, body.rows ?? []);
  }

  @Post("import")
  @RequirePermission(PERMISSIONS.PARKING_SECTION_WRITE)
  importRows(
    @CurrentUser() user: AuthUser,
    @Body() body: { rows?: Record<string, unknown>[] },
  ) {
    return this.lotsService.importRows(user, body.rows ?? []);
  }

  @Post()
  @RequirePermission(PERMISSIONS.PARKING_SECTION_WRITE)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateParkingLotDto) {
    return this.lotsService.create(user, dto);
  }

  @Patch(":id/status")
  @RequirePermission(PERMISSIONS.PARKING_SECTION_WRITE)
  updateStatus(@Param("id") id: string, @Body() dto: { isActive?: boolean }) {
    return this.lotsService.updateStatus(id, Boolean(dto.isActive));
  }

  @Patch(":id")
  @RequirePermission(PERMISSIONS.PARKING_SECTION_WRITE)
  update(@Param("id") id: string, @Body() dto: UpdateParkingLotDto) {
    return this.lotsService.update(id, dto);
  }

  @Delete(":id")
  @RequirePermission(PERMISSIONS.PARKING_SECTION_WRITE)
  remove(@Param("id") id: string) {
    return this.lotsService.remove(id);
  }
}

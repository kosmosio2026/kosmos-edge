import { PartialType } from '@nestjs/swagger';
import { CreateMyVehicleDto } from './create-my-vehicle.dto';

export class UpdateMyVehicleDto extends PartialType(CreateMyVehicleDto) {}
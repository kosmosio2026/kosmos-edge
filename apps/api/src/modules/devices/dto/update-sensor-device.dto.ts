import { PartialType } from '@nestjs/swagger';
import { CreateSensorDeviceDto } from './create-sensor-device.dto';

export class UpdateSensorDeviceDto extends PartialType(CreateSensorDeviceDto) {}
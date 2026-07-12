import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import mqtt, { MqttClient } from 'mqtt';

@Injectable()
export class DisplayMqttPublisher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DisplayMqttPublisher.name);
  private client: MqttClient | null = null;

  onModuleInit() {
    const brokerUrl = process.env.MQTT_BROKER_URL;
    if (!brokerUrl) {
      this.logger.warn('MQTT_BROKER_URL is not set; MQTT publish disabled');
      return;
    }

    this.client = mqtt.connect(brokerUrl, {
      username: process.env.MQTT_USERNAME,
      password: process.env.MQTT_PASSWORD,
      reconnectPeriod: 1000,
    });

    this.client.on('connect', () => {
      this.logger.log(`Connected to MQTT broker: ${brokerUrl}`);
    });

    this.client.on('reconnect', () => {
      this.logger.warn('Reconnecting to MQTT broker...');
    });

    this.client.on('error', (error) => {
      this.logger.error(`MQTT error: ${error.message}`);
    });
  }

  onModuleDestroy() {
    this.client?.end(true);
  }

  async publish(topic: string, payload: unknown) {
    if (!this.client) {
      this.logger.warn(`Publish skipped, MQTT client unavailable: ${topic}`);
      return;
    }

    await new Promise<void>((resolve, reject) => {
      this.client!.publish(
        topic,
        JSON.stringify(payload),
        { qos: 1, retain: false },
        (error) => {
          if (error) reject(error);
          else resolve();
        },
      );
    });
  }
}
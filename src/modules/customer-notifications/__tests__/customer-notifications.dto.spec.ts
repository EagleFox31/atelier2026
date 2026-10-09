import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  ConsentChannelParamDto,
  RecordConsentDto,
  UpdateNotificationSettingsDto,
} from '../dto/customer-notifications.dto';

function errors<T extends object>(cls: new () => T, plain: object): string[] {
  return validateSync(plainToInstance(cls, plain), { whitelist: true, forbidNonWhitelisted: true })
    .map((error) => error.property);
}

const CUSTOMER_ID = '3f2b8c1e-7a4d-4e5f-9b6a-1c2d3e4f5a6b';

describe('DTO notifications client', () => {
  it('canal : WhatsApp seul au lot 2', () => {
    expect(errors(ConsentChannelParamDto, { customerId: CUSTOMER_ID, channel: 'WHATSAPP' })).toEqual([]);
    expect(errors(ConsentChannelParamDto, { customerId: CUSTOMER_ID, channel: 'SMS' })).toEqual(['channel']);
    expect(errors(ConsentChannelParamDto, { customerId: 'abc', channel: 'WHATSAPP' })).toEqual(['customerId']);
  });

  it('consentement : statut et source obligatoires, champ inconnu refusé', () => {
    expect(errors(RecordConsentDto, { status: 'GRANTED', source: 'IN_PERSON' })).toEqual([]);
    expect(errors(RecordConsentDto, { status: 'GRANTED' })).toEqual(['source']);
    expect(errors(RecordConsentDto, { status: 'GRANTED', source: 'IN_PERSON', recordedById: 'x' })).toEqual(['recordedById']);
  });

  it('préférences : événement connu, booléen strict', () => {
    expect(errors(UpdateNotificationSettingsDto, { settings: [{ eventType: 'VEHICLE_READY', enabled: false }] })).toEqual([]);
    expect(errors(UpdateNotificationSettingsDto, { settings: [{ eventType: 'NOPE', enabled: 'yes' }] })).toEqual(['settings']);
    expect(errors(UpdateNotificationSettingsDto, { settings: [] })).toEqual(['settings']);
  });
});

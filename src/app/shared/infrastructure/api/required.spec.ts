import { required } from './required';

describe('required', () => {
  it('returns a present value, including falsy ones', () => {
    expect(required(0, 'Appointment.priceCents')).toBe(0);
    expect(required('', 'Customer.notes')).toBe('');
  });

  it('names the missing field', () => {
    expect(() => required(undefined, 'Appointment.id')).toThrow('pibble sent no Appointment.id');
    expect(() => required(null, 'Appointment.id')).toThrow('pibble sent no Appointment.id');
  });
});

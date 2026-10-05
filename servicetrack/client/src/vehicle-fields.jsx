import { useId, useState } from 'react';
import { Field } from './components';
// Editable starter suggestions, not a complete catalogue or a fitment database.
const makes = {
  'Maruti Suzuki': ['Swift', 'Baleno', 'Wagon R', 'Brezza', 'Dzire', 'Ertiga'],
  Hyundai: ['i20', 'i10', 'Creta', 'Venue', 'Verna'],
  Tata: ['Nexon', 'Punch', 'Tiago', 'Altroz', 'Nexon EV', 'Tiago EV'],
  Mahindra: ['Scorpio', 'Bolero', 'Thar', 'XUV700'],
  Toyota: ['Innova', 'Fortuner', 'Glanza'],
  Honda: ['City', 'Amaze', 'Shine', 'Activa', 'Unicorn'],
  'Hero MotoCorp': ['Splendor', 'Passion', 'Glamour', 'Xpulse'],
  Bajaj: ['Pulsar 150', 'Pulsar NS200', 'Platina', 'Chetak'],
  TVS: ['Apache', 'Jupiter', 'Raider', 'iQube'],
  Yamaha: ['FZ', 'R15', 'Fascino'],
  'Royal Enfield': ['Classic 350', 'Bullet 350', 'Hunter 350'],
  Suzuki: ['Access 125', 'Gixxer', 'Burgman Street'],
  Ather: ['450X', 'Rizta'],
  Ola: ['S1 Pro', 'S1 Air'],
  MG: ['Comet EV', 'ZS EV', 'Hector'],
};
const electric = new Set([
  'Nexon EV',
  'Tiago EV',
  'Chetak',
  'iQube',
  '450X',
  'Rizta',
  'S1 Pro',
  'S1 Air',
  'Comet EV',
  'ZS EV',
]);
export function VehicleFields() {
  const key = useId(),
    [make, setMake] = useState(''),
    [model, setModel] = useState(''),
    [fuel, setFuel] = useState('Petrol');
  function chooseModel(value) {
    setModel(value);
    const matches = Object.entries(makes).filter(([, models]) =>
      models.some((m) => m.toLowerCase() === value.toLowerCase()),
    );
    if (matches.length === 1) {
      setMake(matches[0][0]);
      const exact = matches[0][1].find((m) => m.toLowerCase() === value.toLowerCase());
      if (electric.has(exact)) setFuel('Electric');
    }
  }
  return (
    <>
      <div className="two-cols">
        <Field label="Make">
          <input
            name="make"
            list={`${key}-makes`}
            value={make}
            maxLength={50}
            onChange={(e) => {
              setMake(e.target.value);
              setModel('');
            }}
            required
            placeholder="Type or choose a manufacturer"
          />
          <datalist id={`${key}-makes`}>
            {Object.keys(makes).map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </Field>
        <Field label="Model">
          <input
            name="model"
            list={`${key}-models`}
            value={model}
            maxLength={60}
            onChange={(e) => chooseModel(e.target.value)}
            required
            placeholder="Type or choose a model"
          />
          <datalist id={`${key}-models`}>
            {(makes[make] || Object.values(makes).flat()).map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </Field>
      </div>
      <p className="fine">
        Choose a make to narrow models, or enter a known model to suggest its make. Custom entries
        are welcome; confirm fuel type below.
      </p>
      <div className="two-cols">
        <Field label="Colour">
          <input
            name="color"
            list={`${key}-colors`}
            maxLength={40}
            placeholder="e.g. Pearl white"
          />
          <datalist id={`${key}-colors`}>
            {[
              'White',
              'Black',
              'Silver',
              'Grey',
              'Red',
              'Blue',
              'Green',
              'Brown',
              'Orange',
              'Yellow',
              'Pearl white',
            ].map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field label="Fuel / powertrain">
          <select name="fuelType" value={fuel} onChange={(e) => setFuel(e.target.value)}>
            {['Petrol', 'Diesel', 'Electric', 'Hybrid', 'CNG', 'Other'].map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </Field>
      </div>
      {['Electric', 'Hybrid'].includes(fuel) && (
        <div className="ev-note">
          <Field label="Reported battery charge at registration (%) — optional">
            <input
              name="batteryPercent"
              type="number"
              min="0"
              max="100"
              step="1"
              placeholder="e.g. 65"
            />
          </Field>
          <span className="fine">
            A customer-reported intake value; not a battery health assessment.
          </span>
        </div>
      )}
    </>
  );
}
export const labourSuggestions = [
  'Inspection and diagnosis',
  'Engine oil and filter replacement labour',
  'Tyre replacement and balancing labour',
  'Brake inspection and adjustment',
  'Wheel alignment',
  'Chain cleaning and lubrication labour',
  'Battery and charging-system inspection',
  'AC inspection',
  'Vehicle cleaning',
  'EV visual inspection by qualified staff',
];

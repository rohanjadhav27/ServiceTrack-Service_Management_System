import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { config } from './config.js';
import { User, Customer, Vehicle, Booking, Slot, Job, Part } from './models.js';
import { performAction } from './job-service.js';
import { record } from './domain.js';
import { catalogue } from './catalogue.js';
await mongoose.connect(config.mongo, { serverSelectionTimeoutMS: 5000 });
try {
  await Promise.all(
    [User, Customer, Vehicle, Booking, Slot, Job, Part].map((model) => model.init()),
  );
  if (await User.countDocuments()) {
    console.log('Database already contains users. Existing records preserved; seed skipped.');
  } else {
    const hash = await bcrypt.hash('Demo@12345', 12);
    const [advisor, tech, tech2] = await User.create([
      {
        name: 'Aditi Deshmukh',
        email: 'advisor@servicetrack.local',
        passwordHash: hash,
        role: 'advisor',
      },
      {
        name: 'Rohan Patil',
        email: 'technician@servicetrack.local',
        passwordHash: hash,
        role: 'technician',
      },
      {
        name: 'Neha Jadhav',
        email: 'neha@servicetrack.local',
        passwordHash: hash,
        role: 'technician',
      },
    ]);
    const [oil, filter, brakes] = await Part.create([
      { sku: 'OIL-10W30', name: 'Engine oil · 1 litre', pricePaise: 45000, stock: 24, minimum: 5 },
      { sku: 'FLT-001', name: 'Oil filter', pricePaise: 18000, stock: 12, minimum: 4 },
      { sku: 'BRK-001', name: 'Front brake pad set', pricePaise: 85000, stock: 2, minimum: 3 },
      { sku: 'AIR-001', name: 'Air filter', pricePaise: 32000, stock: 0, minimum: 3 },
    ]);
    const names = ['Arjun More', 'Mira Kulkarni', 'Kabir Shah'];
    const tomorrow = new Date(Date.now() + 86400000 + 19800000).toISOString().slice(0, 10);
    for (let i = 0; i < names.length; i++) {
      const customer = await Customer.create({ name: names[i], phone: `900000000${i}`, email: '' });
      const vehicle = await Vehicle.create({
        customer: customer._id,
        registration: ['MH11DE2048', 'MH12KT7302', 'MH09AV5106'][i],
        make: ['Honda', 'Maruti Suzuki', 'Bajaj'][i],
        model: ['Shine', 'Swift', 'Pulsar 150'][i],
      });
      const slot = `${tomorrow}T${10 + i}:00`;
      await Slot.create({ key: slot, count: 1 });
      const booking = await Booking.create({
        customer: customer._id,
        vehicle: vehicle._id,
        slot,
        serviceType: 'Routine Maintenance',
        complaint: [
          'Routine oil change; engine sounds louder than usual.',
          'Brakes squeak during low-speed stopping.',
          'Vehicle needs a routine inspection.',
        ][i],
      });
      if (i === 2) continue;
      let job = await Job.create({
        number: `ST-DEMO00${i + 1}`,
        booking: booking._id,
        customer: customer._id,
        vehicle: vehicle._id,
        technician: i ? tech2._id : tech._id,
        mileage: 12000 + i * 5000,
        complaint: booking.complaint,
      });
      record(job, advisor, 'Vehicle checked in', 'Fictional demonstration record');
      await job.save();
      booking.status = 'Checked In';
      booking.job = job._id;
      await booking.save();
      async function act(action, body) {
        job = await Job.findById(job._id);
        await performAction(job._id, action, { ...body, version: job.__v }, advisor);
      }
      await act('inspect', {
        inspection: i
          ? 'Inspected front pads; recommend replacement after customer approval.'
          : 'Oil change due. Replace oil and filter; inspect for leaks.',
      });
      await act('estimate', {
        lines: i
          ? [
              { kind: 'part', part: String(brakes._id), quantity: 1 },
              { kind: 'labour', description: 'Brake service', quantity: 1, unitPricePaise: 40000 },
            ]
          : [
              { kind: 'part', part: String(oil._id), quantity: 1 },
              { kind: 'part', part: String(filter._id), quantity: 1 },
              {
                kind: 'labour',
                description: 'Oil change and leak inspection',
                quantity: 0.5,
                unitPricePaise: 50000,
              },
            ],
      });
      if (!i) {
        await act('decision', {
          approved: true,
          method: 'In person',
          note: 'Customer approved the complete estimate at reception.',
        });
        await act('status', { status: 'In Service' });
      }
    }
    console.log('Fictional demo data created. Login: advisor@servicetrack.local / Demo@12345');
    console.log('Technician: technician@servicetrack.local / Demo@12345');
  }
  await Part.bulkWrite(
    catalogue.map((item) => ({
      updateOne: { filter: { sku: item.sku }, update: { $setOnInsert: item }, upsert: true },
    })),
  );
} finally {
  await mongoose.disconnect();
}

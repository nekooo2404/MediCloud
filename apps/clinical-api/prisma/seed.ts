import {
  AppointmentStatus,
  CheckInStatus,
  EncounterStatus,
  MembershipRole,
  ObservationStatus,
  OutboxStatus,
  PrismaClient,
  QueueTicketStatus,
} from '@prisma/client';

const prisma = new PrismaClient();
const uuid = (n: number) => `00000000-0000-4000-8000-${n.toString().padStart(12, '0')}`;

// Convert local Asia/Ho_Chi_Minh wall time (UTC+7) cleanly into UTC Date.
function gmt7Date(year: number, monthIndex: number, day: number, hour: number, minute = 0): Date {
  return new Date(Date.UTC(year, monthIndex, day, hour - 7, minute, 0, 0));
}

async function main() {
  if (process.env.MEDICLOUD_ENV === 'production' || (process.env.NODE_ENV === 'production' && process.env.ALLOW_SYNTHETIC_SEED !== 'true')) {
    throw new Error('Refusing to run synthetic demo seed in production environment');
  }

  const tenants = await Promise.all([
    prisma.tenant.upsert({
      where: {code: 'synthetic-hospital-a'},
      update: {name: 'MediCloud Clinic A (Hà Nội)'},
      create: {id: uuid(1), code: 'synthetic-hospital-a', name: 'MediCloud Clinic A (Hà Nội)'},
    }),
    prisma.tenant.upsert({
      where: {code: 'synthetic-hospital-b'},
      update: {name: 'MediCloud Clinic B (TP.HCM)'},
      create: {id: uuid(2), code: 'synthetic-hospital-b', name: 'MediCloud Clinic B (TP.HCM)'},
    }),
  ]);

  const orgs = await Promise.all([
    prisma.organization.upsert({
      where: {id: uuid(900)},
      update: {code: 'FAC-HN-01', name: 'Cơ sở Trung tâm Hà Nội'},
      create: {id: uuid(900), tenantId: tenants[0].id, code: 'FAC-HN-01', name: 'Cơ sở Trung tâm Hà Nội'},
    }),
    prisma.organization.upsert({
      where: {id: uuid(901)},
      update: {code: 'FAC-HCM-01', name: 'Cơ sở Trung tâm TP.HCM'},
      create: {id: uuid(901), tenantId: tenants[1].id, code: 'FAC-HCM-01', name: 'Cơ sở Trung tâm TP.HCM'},
    }),
  ]);

  const depts = await Promise.all([
    prisma.department.upsert({
      where: {tenantId_code: {tenantId: tenants[0].id, code: 'DEPT-INTERNAL'}},
      update: {name: 'Khoa Nội tổng quát'},
      create: {id: uuid(910), tenantId: tenants[0].id, organizationId: orgs[0].id, code: 'DEPT-INTERNAL', name: 'Khoa Nội tổng quát'},
    }),
    prisma.department.upsert({
      where: {tenantId_code: {tenantId: tenants[0].id, code: 'DEPT-CARDIO'}},
      update: {name: 'Khoa Tim mạch'},
      create: {id: uuid(911), tenantId: tenants[0].id, organizationId: orgs[0].id, code: 'DEPT-CARDIO', name: 'Khoa Tim mạch'},
    }),
    prisma.department.upsert({
      where: {tenantId_code: {tenantId: tenants[0].id, code: 'DEPT-PEDS'}},
      update: {name: 'Khoa Nhi tổng quát'},
      create: {id: uuid(912), tenantId: tenants[0].id, organizationId: orgs[0].id, code: 'DEPT-PEDS', name: 'Khoa Nhi tổng quát'},
    }),
    prisma.department.upsert({
      where: {tenantId_code: {tenantId: tenants[1].id, code: 'DEPT-INTERNAL-B'}},
      update: {name: 'Khoa Nội B'},
      create: {id: uuid(913), tenantId: tenants[1].id, organizationId: orgs[1].id, code: 'DEPT-INTERNAL-B', name: 'Khoa Nội B'},
    }),
  ]);

  const users = [];
  for (let index = 0; index < 8; index += 1) {
    users.push(
      await prisma.user.upsert({
        where: {subject: `synthetic-subject-${index + 1}`},
        update: {},
        create: {id: uuid(10 + index), subject: `synthetic-subject-${index + 1}`},
      }),
    );
  }

  const roles = [
    MembershipRole.PATIENT,
    MembershipRole.GUARDIAN,
    MembershipRole.RECEPTIONIST,
    MembershipRole.PHYSICIAN,
    MembershipRole.NURSE,
    MembershipRole.AUDITOR,
  ];
  for (let index = 0; index < users.length; index += 1) {
    const tenant = tenants[index % tenants.length];
    await prisma.membership.upsert({
      where: {tenantId_userId_role: {tenantId: tenant.id, userId: users[index].id, role: roles[index % roles.length]}},
      update: {revokedAt: null},
      create: {tenantId: tenant.id, userId: users[index].id, role: roles[index % roles.length]},
    });
  }

  // Ensure primary clinician & intake staff (synthetic-subject-4) holds multi-role access across Tenant A & Tenant B
  for (const tenant of tenants) {
    for (const role of [MembershipRole.PHYSICIAN, MembershipRole.RECEPTIONIST, MembershipRole.NURSE, MembershipRole.AUDITOR]) {
      await prisma.membership.upsert({
        where: {tenantId_userId_role: {tenantId: tenant.id, userId: users[3].id, role}},
        update: {revokedAt: null},
        create: {tenantId: tenant.id, userId: users[3].id, role},
      });
    }
  }
  // Also allow primary demo patient (synthetic-subject-1) optional Hospital B membership for multi-tenant selector demo
  await prisma.membership.upsert({
    where: {tenantId_userId_role: {tenantId: tenants[1].id, userId: users[0].id, role: MembershipRole.PATIENT}},
    update: {revokedAt: null},
    create: {tenantId: tenants[1].id, userId: users[0].id, role: MembershipRole.PATIENT},
  });

  const patientBindings = [
    {tenant: tenants[0], user: users[0], name: 'Nguyễn Minh An (Mẫu)', code: 'MC-SYN-2026-001', blood: 'O+', allergies: ['Penicillin', 'Dị ứng phấn hoa']},
    {tenant: tenants[1], user: users[1], name: 'Trần Gia Bảo (Mẫu)', code: 'MC-SYN-2026-002', blood: 'A+', allergies: ['Hải sản']},
    {tenant: tenants[0], user: users[6], name: 'Lê Thu Trang (Mẫu)', code: 'MC-SYN-2026-003', blood: 'B+', allergies: []},
    {tenant: tenants[1], user: users[7], name: 'Phạm Quốc Khánh (Mẫu)', code: 'MC-SYN-2026-004', blood: 'AB+', allergies: ['Ibuprofen']},
  ];

  const patients = [];
  for (let index = 0; index < patientBindings.length; index += 1) {
    const item = patientBindings[index];
    const patient = await prisma.patient.upsert({
      where: {tenantId_profileRef: {tenantId: item.tenant.id, profileRef: `synthetic-profile-${index + 1}`}},
      update: {userId: item.user.id},
      create: {
        id: uuid(30 + index),
        tenantId: item.tenant.id,
        userId: item.user.id,
        profileRef: `synthetic-profile-${index + 1}`,
      },
    });
    patients.push(patient);
    await prisma.patientProfile.upsert({
      where: {tenantId_patientId: {tenantId: item.tenant.id, patientId: patient.id}},
      update: {
        displayName: item.name,
        medicalRecordCode: item.code,
        bloodType: item.blood,
        allergies: item.allergies,
      },
      create: {
        id: uuid(930 + index),
        tenantId: item.tenant.id,
        patientId: patient.id,
        displayName: item.name,
        medicalRecordCode: item.code,
        bloodType: item.blood,
        allergies: item.allergies,
        careTeamNotes: 'Hồ sơ giả lập P0 phục vụ kiểm thử nội bộ MediCloud.',
      },
    });
  }

  // Guardian delegation fixture in Tenant A
  await prisma.membership.upsert({
    where: {tenantId_userId_role: {tenantId: tenants[0].id, userId: users[1].id, role: MembershipRole.GUARDIAN}},
    update: {revokedAt: null},
    create: {tenantId: tenants[0].id, userId: users[1].id, role: MembershipRole.GUARDIAN},
  });
  await prisma.guardianDelegation.upsert({
    where: {tenantId_guardianUserId_patientId: {tenantId: tenants[0].id, guardianUserId: users[1].id, patientId: patients[0].id}},
    update: {revokedAt: null, expiresAt: gmt7Date(2027, 11, 31, 23, 59)},
    create: {
      id: uuid(940),
      tenantId: tenants[0].id,
      guardianUserId: users[1].id,
      patientId: patients[0].id,
      scope: 'FULL_PORTAL',
      expiresAt: gmt7Date(2027, 11, 31, 23, 59),
    },
  });

  // Practitioners across Tenant A & Tenant B
  const practitionersMeta = [
    {id: uuid(40), tenant: tenants[0], user: users[3], org: orgs[0], dept: depts[0], specialty: 'Nội tổng quát', displayName: 'TS. BS. Nguyễn Hoàng Minh', degreeTitle: 'Trưởng khoa Nội tổng quát', roomLabel: 'Phòng 204 · Tầng 2'},
    {id: uuid(41), tenant: tenants[1], user: users[4], org: orgs[1], dept: depts[3], specialty: 'Nội tổng quát', displayName: 'BS. CKII Đặng Minh Tuấn', degreeTitle: 'Bác sĩ điều trị', roomLabel: 'Phòng B102 · Tầng 1'},
    {id: uuid(42), tenant: tenants[0], user: users[5], org: orgs[0], dept: depts[1], specialty: 'Tim mạch', displayName: 'BS. CKII Lê Quang Huy', degreeTitle: 'Phó khoa Tim mạch', roomLabel: 'Phòng 208 · Tầng 2'},
    {id: uuid(43), tenant: tenants[1], user: users[6], org: orgs[1], dept: depts[3], specialty: 'Tim mạch', displayName: 'ThS. BS. Võ Hoài Nam', degreeTitle: 'Bác sĩ chuyên khoa Tim mạch', roomLabel: 'Phòng B205 · Tầng 2'},
    {id: uuid(44), tenant: tenants[0], user: users[4], org: orgs[0], dept: depts[2], specialty: 'Nhi khoa', displayName: 'PGS. TS. Trần Thu Hà', degreeTitle: 'Chuyên gia Nhi khoa', roomLabel: 'Phòng 105 · Tầng 1'},
    {id: uuid(45), tenant: tenants[0], user: users[7], org: orgs[0], dept: depts[0], specialty: 'Da liễu & Tư vấn', displayName: 'ThS. BS. Phạm Thảo Vy', degreeTitle: 'Bác sĩ chuyên khoa', roomLabel: 'Phòng 302 · Tầng 3'},
  ];

  const practitioners = [];
  for (const pm of practitionersMeta) {
    practitioners.push(
      await prisma.practitioner.upsert({
        where: {tenantId_userId: {tenantId: pm.tenant.id, userId: pm.user.id}},
        update: {
          organizationId: pm.org.id,
          departmentId: pm.dept.id,
          specialty: pm.specialty,
          displayName: pm.displayName,
          degreeTitle: pm.degreeTitle,
          roomLabel: pm.roomLabel,
        },
        create: {
          id: pm.id,
          tenantId: pm.tenant.id,
          userId: pm.user.id,
          organizationId: pm.org.id,
          departmentId: pm.dept.id,
          specialty: pm.specialty,
          displayName: pm.displayName,
          degreeTitle: pm.degreeTitle,
          roomLabel: pm.roomLabel,
        },
      }),
    );
  }

  // Legacy baseline 40 schedules/slots preserved cleanly for existing appointments
  const slots = [];
  for (let index = 0; index < 40; index += 1) {
    const tenant = tenants[index % tenants.length];
    const tenantPractitioners = practitioners.filter((p) => p.tenantId === tenant.id);
    const practitioner = tenantPractitioners[index % tenantPractitioners.length];
    const startsAt = new Date(Date.UTC(2026, 10, 24 + Math.floor(index / 4), 8 + (index % 4)));
    const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
    const schedule = await prisma.schedule.upsert({
      where: {id: uuid(100 + index)},
      update: {startsAt, endsAt},
      create: {id: uuid(100 + index), tenantId: tenant.id, practitionerId: practitioner.id, startsAt, endsAt},
    });
    slots.push(
      await prisma.appointmentSlot.upsert({
        where: {id: uuid(200 + index)},
        update: {startsAt, endsAt},
        create: {
          id: uuid(200 + index),
          tenantId: tenant.id,
          scheduleId: schedule.id,
          startsAt,
          endsAt,
          capacity: index % 3 === 0 ? 2 : 1,
        },
      }),
    );
  }

  // 14-day GMT+7 published schedules (Morning 08:00-12:00 & Afternoon 14:00-18:00) per practitioner in Tenant A
  const tenantAPractitioners = practitioners.filter((p) => p.tenantId === tenants[0].id);
  let pubSeq = 0;
  for (let dayOffset = 0; dayOffset < 14; dayOffset += 1) {
    for (const doc of tenantAPractitioners) {
      for (const session of [
        {name: 'morning', startHour: 8, endHour: 12, hours: [8, 9, 10, 11]},
        {name: 'afternoon', startHour: 14, endHour: 18, hours: [14, 15, 16, 17]},
      ]) {
        pubSeq += 1;
        const scheduleId = uuid(1000 + pubSeq);
        const sStart = gmt7Date(2026, 10, 24 + dayOffset, session.startHour);
        const sEnd = gmt7Date(2026, 10, 24 + dayOffset, session.endHour);
        await prisma.schedule.upsert({
          where: {id: scheduleId},
          update: {startsAt: sStart, endsAt: sEnd},
          create: {
            id: scheduleId,
            tenantId: tenants[0].id,
            practitionerId: doc.id,
            startsAt: sStart,
            endsAt: sEnd,
          },
        });
        for (let hIdx = 0; hIdx < session.hours.length; hIdx += 1) {
          const hour = session.hours[hIdx];
          const slotStart = gmt7Date(2026, 10, 24 + dayOffset, hour);
          const slotEnd = gmt7Date(2026, 10, 24 + dayOffset, hour + 1);
          const slotId = uuid(20000 + pubSeq * 10 + hIdx);
          await prisma.appointmentSlot.upsert({
            where: {tenantId_scheduleId_startsAt: {tenantId: tenants[0].id, scheduleId, startsAt: slotStart}},
            update: {endsAt: slotEnd, capacity: 3},
            create: {
              id: slotId,
              tenantId: tenants[0].id,
              scheduleId,
              startsAt: slotStart,
              endsAt: slotEnd,
              capacity: 3,
            },
          });
        }
      }
    }
  }

  const appointments = [];
  const statuses = [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED, AppointmentStatus.CANCELLED, AppointmentStatus.COMPLETED];
  for (let index = 0; index < 20; index += 1) {
    const tenant = tenants[index % tenants.length];
    const tenantPatients = patients.filter((p) => p.tenantId === tenant.id);
    const patient = tenantPatients[index % tenantPatients.length];
    const slot = slots[index];
    const status = statuses[index % statuses.length];
    const isCheckedIn = status === AppointmentStatus.CONFIRMED || status === AppointmentStatus.COMPLETED;
    const appt = await prisma.appointment.upsert({
      where: {tenantId_idempotencyKey: {tenantId: tenant.id, idempotencyKey: `synthetic-idempotency-${index + 1}`}},
      update: {
        checkInStatus: isCheckedIn ? CheckInStatus.CHECKED_IN : CheckInStatus.NOT_CHECKED_IN,
        checkedInByUserId: isCheckedIn ? users[3].id : null,
        actorSubject: users[0].subject,
        visitType: index % 2 === 0 ? 'Khám mới chuyên khoa' : 'Tái khám định kỳ',
        visitReason: index % 2 === 0 ? 'Kiểm tra tổng quát' : 'Theo dõi chỉ số định kỳ',
      },
      create: {
        id: uuid(300 + index),
        tenantId: tenant.id,
        patientId: patient.id,
        slotId: slot.id,
        status,
        checkInStatus: isCheckedIn ? CheckInStatus.CHECKED_IN : CheckInStatus.NOT_CHECKED_IN,
        checkedInAt: isCheckedIn ? new Date() : null,
        checkedInByUserId: isCheckedIn ? users[3].id : null,
        actorSubject: users[0].subject,
        visitType: index % 2 === 0 ? 'Khám mới chuyên khoa' : 'Tái khám định kỳ',
        visitReason: index % 2 === 0 ? 'Kiểm tra tổng quát' : 'Theo dõi chỉ số định kỳ',
        idempotencyKey: `synthetic-idempotency-${index + 1}`,
      },
    });
    appointments.push(appt);

    if (appt.checkInStatus === CheckInStatus.CHECKED_IN) {
      await prisma.queueTicket.upsert({
        where: {tenantId_appointmentId: {tenantId: tenant.id, appointmentId: appt.id}},
        update: {},
        create: {
          id: uuid(800 + index),
          tenantId: tenant.id,
          appointmentId: appt.id,
          patientId: appt.patientId,
          ticketNumber: `A-${(101 + index).toString()}`,
          status: appt.status === AppointmentStatus.COMPLETED ? QueueTicketStatus.DONE : QueueTicketStatus.WAITING,
          completedAt: appt.status === AppointmentStatus.COMPLETED ? new Date() : null,
        },
      });
    }
  }

  // Reconcile slot bookedCount strictly from persisted active bookings
  const allSlots = await prisma.appointmentSlot.findMany({select: {id: true, tenantId: true, bookedCount: true}});
  for (const slot of allSlots) {
    const bookedCount = await prisma.appointment.count({
      where: {
        tenantId: slot.tenantId,
        slotId: slot.id,
        status: {in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED, AppointmentStatus.COMPLETED]},
      },
    });
    if (bookedCount !== slot.bookedCount) {
      await prisma.appointmentSlot.update({where: {id: slot.id}, data: {bookedCount}});
    }
  }

  for (let index = 0; index < 10; index += 1) {
    const tenant = tenants[index % tenants.length];
    const appointment = appointments[index];
    const tenantPractitioners = practitioners.filter((p) => p.tenantId === tenant.id);
    const practitioner = tenantPractitioners[index % tenantPractitioners.length];
    const isCompleted = index % 2 === 1;
    const encounter = await prisma.encounter.upsert({
      where: {id: uuid(400 + index)},
      update: {},
      create: {
        id: uuid(400 + index),
        tenantId: tenant.id,
        appointmentId: appointment.id,
        patientId: appointment.patientId,
        practitionerId: practitioner.id,
        status: isCompleted ? EncounterStatus.COMPLETED : EncounterStatus.IN_PROGRESS,
        startedAt: new Date(Date.UTC(2026, 10, 24, 7 + index)),
        completedAt: isCompleted ? new Date(Date.UTC(2026, 10, 24, 8 + index)) : null,
        completedByUserId: isCompleted ? users[3].id : null,
      },
    });
    await prisma.observation.upsert({
      where: {id: uuid(500 + index)},
      update: {
        code: index % 2 === 0 ? 'synthetic-systolic-bp' : 'synthetic-heart-rate',
        value: index % 2 === 0 ? 118 + (index % 5) : 70 + index,
        unit: index % 2 === 0 ? 'mmHg' : 'bpm',
        status: isCompleted ? ObservationStatus.FINAL : ObservationStatus.PRELIMINARY,
      },
      create: {
        id: uuid(500 + index),
        tenantId: tenant.id,
        encounterId: encounter.id,
        code: index % 2 === 0 ? 'synthetic-systolic-bp' : 'synthetic-heart-rate',
        value: index % 2 === 0 ? 118 + (index % 5) : 70 + index,
        unit: index % 2 === 0 ? 'mmHg' : 'bpm',
        status: isCompleted ? ObservationStatus.FINAL : ObservationStatus.PRELIMINARY,
        authorUserId: users[3].id,
        measuredAt: new Date(Date.UTC(2026, 10, 24, 8 + index)),
      },
    });
  }

  // Dedicated active fixtures assigned to primary staff clinician (TS. BS. Nguyễn Hoàng Minh / synthetic-subject-4)
  const docPrimarySlotA = await prisma.appointmentSlot.findFirst({
    where: {tenantId: tenants[0].id, schedule: {practitionerId: practitioners[0].id}},
    orderBy: {startsAt: 'asc'},
  });
  if (docPrimarySlotA) {
    const staffReadyAppt = await prisma.appointment.upsert({
      where: {tenantId_idempotencyKey: {tenantId: tenants[0].id, idempotencyKey: 'synthetic-staff-ready-001'}},
      update: {
        slotId: docPrimarySlotA.id,
        status: AppointmentStatus.CONFIRMED,
        checkInStatus: CheckInStatus.CHECKED_IN,
        checkedInByUserId: users[3].id,
        visitType: 'in_person',
        visitReason: 'general_checkup',
      },
      create: {
        id: uuid(350),
        tenantId: tenants[0].id,
        patientId: patients[0].id,
        slotId: docPrimarySlotA.id,
        status: AppointmentStatus.CONFIRMED,
        checkInStatus: CheckInStatus.CHECKED_IN,
        checkedInAt: new Date(),
        checkedInByUserId: users[3].id,
        actorSubject: users[0].subject,
        visitType: 'in_person',
        visitReason: 'general_checkup',
        idempotencyKey: 'synthetic-staff-ready-001',
      },
    });
    await prisma.queueTicket.upsert({
      where: {tenantId_appointmentId: {tenantId: tenants[0].id, appointmentId: staffReadyAppt.id}},
      update: {status: QueueTicketStatus.WAITING},
      create: {
        id: uuid(850),
        tenantId: tenants[0].id,
        appointmentId: staffReadyAppt.id,
        patientId: staffReadyAppt.patientId,
        ticketNumber: 'A-401',
        status: QueueTicketStatus.WAITING,
      },
    });
  }

  for (let index = 0; index < 50; index += 1) {
    const tenant = tenants[index % tenants.length];
    const rejected = index === 0;
    const duplicate = index === 1;
    const payload = {
      appointment_ref: `synthetic-appointment-${(index % appointments.length) + 1}`,
      channel: 'portal',
      ...(rejected ? {policy_case: 'rejected'} : {}),
      ...(duplicate ? {policy_case: 'duplicate'} : {}),
    };
    await prisma.outboxEvent.upsert({
      where: {eventId: uuid(600 + index)},
      update: {
        payload,
        status: rejected || duplicate ? OutboxStatus.FAILED : OutboxStatus.PENDING,
        lastError: rejected ? 'policy-rejected-synthetic-fixture' : duplicate ? 'duplicate-synthetic-fixture' : null,
      },
      create: {
        eventId: uuid(600 + index),
        tenantId: tenant.id,
        eventType: 'appointment.created',
        schemaVersion: 1,
        correlationId: `synthetic-trace-${index + 1}`,
        payload,
        status: rejected || duplicate ? OutboxStatus.FAILED : OutboxStatus.PENDING,
        lastError: rejected ? 'policy-rejected-synthetic-fixture' : duplicate ? 'duplicate-synthetic-fixture' : null,
      },
    });
  }

  await prisma.auditEvent.upsert({
    where: {id: uuid(700)},
    update: {},
    create: {
      id: uuid(700),
      tenantId: tenants[0].id,
      actorId: users[0].id,
      action: 'synthetic.seed',
      resourceRef: 'synthetic-seed',
      purpose: 'testing',
      correlationId: 'synthetic-audit-001',
      metadata: {fixture: true},
    },
  });

  const counts = await Promise.all([
    prisma.tenant.count(),
    prisma.user.count(),
    prisma.practitioner.count(),
    prisma.appointmentSlot.count(),
    prisma.appointment.count(),
    prisma.encounter.count(),
    prisma.observation.count(),
    prisma.outboxEvent.count(),
    prisma.queueTicket.count(),
  ]);
  console.log(
    JSON.stringify({
      tenants: counts[0],
      users: counts[1],
      practitioners: counts[2],
      slots: counts[3],
      appointments: counts[4],
      encounters: counts[5],
      observations: counts[6],
      outboxEvents: counts[7],
      queueTickets: counts[8],
    }),
  );
}

main().finally(() => prisma.$disconnect());

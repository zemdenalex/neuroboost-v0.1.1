import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Helper: Moscow local to UTC ISO
function mskToUtcISO(dateTimeLocal) {
  // dateTimeLocal like '2025-08-21T12:00:00+03:00'
  return new Date(dateTimeLocal).toISOString();
}

async function main() {
  const task = await prisma.task.create({
    data: {
      title: 'Sample task — write MVP doc',
      description: 'Create user stories + acceptance',
      priority: 3
    }
  });

  const ev = await prisma.event.create({
    data: {
      title: 'Deep work: MVP drafting',
      startsAt: mskToUtcISO('2025-08-21T12:00:00+03:00'),
      endsAt: mskToUtcISO('2025-08-21T14:00:00+03:00'),
      allDay: false,
      rrule: null,
      tz: 'Europe/Moscow',
      task: { connect: { id: task.id } },
      reminders: {
        create: [{ minutesBefore: 5, channel: 'telegram' }]
      }
    },
    include: { reminders: true, task: true }
  });

  console.log('Seeded:', { taskId: task.id, eventId: ev.id });
}

main().finally(() => prisma.$disconnect());

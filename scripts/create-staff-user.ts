// Da de alta un usuario en un tenant YA EXISTENTE (onboard-tenant.ts crea el
// tenant entero desde cero; esto es para sumar gente a uno que ya existe —
// el dueño real del local, un mozo, o la primera cuenta de prueba BARRA).
//
// Uso:
//   npm run create:staff-user -- pizzazeka ezequiel ADMIN
//   npm run create:staff-user -- pizzazeka ezequiel ADMIN "contraseña-elegida"
import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function randomPassword(): string {
  // Legible para pasar por WhatsApp/teléfono: sin 0/O/1/l/I ambiguos.
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 12; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

async function main() {
  const [tenantSlug, username, role, passwordArg] = process.argv.slice(2);
  if (!tenantSlug || !username || !role) {
    console.error('Uso: npm run create:staff-user -- <tenantSlug> <username> <ADMIN|COCINA|CADETE|MOSTRADOR|BARRA> [password]');
    process.exit(1);
  }
  const validRoles = ['ADMIN', 'COCINA', 'CADETE', 'MOSTRADOR', 'BARRA'];
  if (!validRoles.includes(role)) {
    console.error(`Rol inválido "${role}". Válidos: ${validRoles.join(', ')}`);
    process.exit(1);
  }

  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) throw new Error(`Tenant "${tenantSlug}" no existe.`);

  const existingUser = await prisma.user.findUnique({ where: { username } });
  if (existingUser) throw new Error(`El usuario "${username}" ya existe (username es único en toda la base, no solo por tenant).`);

  const branch = await prisma.branch.findFirst({ where: { tenantId: tenant.id, isDefault: true } });
  if (!branch) throw new Error(`Tenant "${tenantSlug}" no tiene sucursal default.`);

  const password = passwordArg || randomPassword();
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: { tenantId: tenant.id, branchId: branch.id, username, passwordHash, role: role as UserRole },
  });

  console.log(`Usuario "${username}" creado en "${tenantSlug}" con rol ${role}.`);
  console.log(`Contraseña: ${password}`);
  console.log('Guardala/pasala ahora — no se vuelve a mostrar.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

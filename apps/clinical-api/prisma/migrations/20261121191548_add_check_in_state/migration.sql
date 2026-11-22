-- CreateEnum
CREATE TYPE "CheckInStatus" AS ENUM ('NOT_CHECKED_IN', 'CHECKED_IN', 'VOIDED');

-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "checkInStatus" "CheckInStatus" NOT NULL DEFAULT 'NOT_CHECKED_IN',
ADD COLUMN     "checkedInAt" TIMESTAMPTZ(3),
ADD COLUMN     "checkedInByUserId" UUID;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_checkedInByUserId_fkey" FOREIGN KEY ("checkedInByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

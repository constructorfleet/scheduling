/*
  Warnings:

  - Made the column `role` on table `SchoolMembership` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "SchoolMembership" ALTER COLUMN "role" SET NOT NULL;

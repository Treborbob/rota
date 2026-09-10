-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'ESSENTIAL');

-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('RECURRING', 'ONE_OFF');

-- CreateEnum
CREATE TYPE "AssignmentMode" AS ENUM ('FIXED', 'ALTERNATE', 'BALANCED');

-- CreateEnum
CREATE TYPE "RecurrenceUnit" AS ENUM ('DAY', 'WEEK', 'MONTH', 'YEAR');

-- CreateEnum
CREATE TYPE "RecurrenceAnchor" AS ENUM ('COMPLETION', 'SCHEDULE');

-- CreateEnum
CREATE TYPE "CompletionSource" AS ENUM ('PLAN', 'PICK', 'MANUAL');

-- CreateEnum
CREATE TYPE "PlannedTaskState" AS ENUM ('PLANNED', 'COMPLETED', 'SKIPPED', 'REMOVED', 'UNSCHEDULED');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "household" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/London',
    "locale" TEXT NOT NULL DEFAULT 'en-GB',
    "dueSoonDaysDefault" INTEGER NOT NULL DEFAULT 7,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "household_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekday_capacity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "minutes" INTEGER NOT NULL,

    CONSTRAINT "weekday_capacity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capacity_override" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "localDate" DATE NOT NULL,
    "minutes" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "capacity_override_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "area" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "colour" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "area_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task" (
    "id" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "estimatedMinutes" INTEGER NOT NULL,
    "priority" "Priority" NOT NULL DEFAULT 'NORMAL',
    "unpleasant" BOOLEAN NOT NULL DEFAULT false,
    "taskType" "TaskType" NOT NULL DEFAULT 'RECURRING',
    "assignmentMode" "AssignmentMode" NOT NULL DEFAULT 'BALANCED',
    "fixedAssigneeId" TEXT,
    "recurrenceValue" INTEGER,
    "recurrenceUnit" "RecurrenceUnit",
    "recurrenceAnchor" "RecurrenceAnchor" NOT NULL DEFAULT 'COMPLETION',
    "dueSoonDays" INTEGER,
    "preferredWeekday" INTEGER,
    "allowedWeekdays" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "lastCompletedAt" TIMESTAMP(3),
    "nextDueOn" DATE,
    "deferredUntil" DATE,
    "pausedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_completion" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "completedById" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "previousDueOn" DATE,
    "previousLastCompletedAt" TIMESTAMP(3),
    "actualMinutes" INTEGER,
    "note" TEXT,
    "source" "CompletionSource" NOT NULL,
    "voidedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_completion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_plan" (
    "id" TEXT NOT NULL,
    "weekStartDate" DATE NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "algorithmVersion" TEXT NOT NULL,
    "inputSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weekly_plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planned_task" (
    "id" TEXT NOT NULL,
    "weeklyPlanId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "plannedDate" DATE,
    "assignedToId" TEXT,
    "estimatedMinutesSnapshot" INTEGER NOT NULL,
    "prioritySnapshot" "Priority" NOT NULL,
    "dueOnSnapshot" DATE,
    "scoreSnapshot" INTEGER NOT NULL,
    "explanationCode" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "state" "PlannedTaskState" NOT NULL DEFAULT 'PLANNED',
    "completionId" TEXT,
    "manualOverride" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "planned_task_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "account_providerId_accountId_key" ON "account"("providerId", "accountId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "weekday_capacity_userId_weekday_key" ON "weekday_capacity"("userId", "weekday");

-- CreateIndex
CREATE UNIQUE INDEX "capacity_override_userId_localDate_key" ON "capacity_override"("userId", "localDate");

-- CreateIndex
CREATE INDEX "area_active_sortOrder_idx" ON "area"("active", "sortOrder");

-- CreateIndex
CREATE INDEX "task_archivedAt_pausedAt_nextDueOn_idx" ON "task"("archivedAt", "pausedAt", "nextDueOn");

-- CreateIndex
CREATE INDEX "task_areaId_idx" ON "task"("areaId");

-- CreateIndex
CREATE INDEX "task_completion_taskId_completedAt_idx" ON "task_completion"("taskId", "completedAt");

-- CreateIndex
CREATE INDEX "task_completion_completedById_completedAt_idx" ON "task_completion"("completedById", "completedAt");

-- CreateIndex
CREATE INDEX "task_completion_completedAt_idx" ON "task_completion"("completedAt");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_plan_weekStartDate_key" ON "weekly_plan"("weekStartDate");

-- CreateIndex
CREATE UNIQUE INDEX "planned_task_completionId_key" ON "planned_task"("completionId");

-- CreateIndex
CREATE INDEX "planned_task_weeklyPlanId_plannedDate_idx" ON "planned_task"("weeklyPlanId", "plannedDate");

-- CreateIndex
CREATE INDEX "planned_task_taskId_idx" ON "planned_task"("taskId");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekday_capacity" ADD CONSTRAINT "weekday_capacity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capacity_override" ADD CONSTRAINT "capacity_override_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "area"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_fixedAssigneeId_fkey" FOREIGN KEY ("fixedAssigneeId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_completion" ADD CONSTRAINT "task_completion_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_completion" ADD CONSTRAINT "task_completion_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_completion" ADD CONSTRAINT "task_completion_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planned_task" ADD CONSTRAINT "planned_task_weeklyPlanId_fkey" FOREIGN KEY ("weeklyPlanId") REFERENCES "weekly_plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planned_task" ADD CONSTRAINT "planned_task_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planned_task" ADD CONSTRAINT "planned_task_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planned_task" ADD CONSTRAINT "planned_task_completionId_fkey" FOREIGN KEY ("completionId") REFERENCES "task_completion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

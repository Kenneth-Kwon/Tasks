-- AlterTable: 드래그 순서 전용 float 필드 추가
ALTER TABLE "Task" ADD COLUMN "sortOrder" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- 기존 데이터: priorityRank를 기반으로 초기 sortOrder 설정
-- (높은 priorityRank = 높은 sortOrder = 목록 상단)
UPDATE "Task" SET "sortOrder" = "priorityRank" * 10000;

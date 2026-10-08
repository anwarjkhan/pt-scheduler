-- How much each dimension counts toward a client's overall score. Percentages
-- that need not sum to 100: they are normalised on read, so nudging one weight
-- does not force the others to be rebalanced by hand.
ALTER TABLE "TrainerSettings" ADD COLUMN     "weightReliability" INTEGER NOT NULL DEFAULT 35,
ADD COLUMN     "weightValue" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "weightPayment" INTEGER NOT NULL DEFAULT 25,
ADD COLUMN     "weightEffort" INTEGER NOT NULL DEFAULT 10;

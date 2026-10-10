import { Router } from 'express';
import authRoutes from './auth';
import plantRoutes from './plants';
import journalRoutes from './journal';
import plantProfileRoutes from './plantProfiles';
import seasonalTipRoutes from './seasonalTips';
import feedingScheduleTemplateRoutes from './feedingScheduleTemplates';
import zoneRoutes from './zones';
import careHistoryRoutes from './careHistory';
import questionRoutes from './questions';
import answerRoutes from './answers';
import gardenRoutes from './gardens';
import recommendationRoutes from './recommendations';
import companionRoutes from './companions';
import aiTaskRoutes from './aiTasks';
import notificationRoutes from './notifications';
import adminRoutes from './admin';
import analysisUsageRoutes from './analysisUsage';
import growRoutes from './grows';
import growLogRoutes from './growLogs';
import nutrientRoutes from './nutrients';
import growNutrientRoutes from './growNutrients';
import growHarvestRoutes from './growHarvests';
import growAnalysesRoutes from './growAnalyses';
import growEnvironmentRoutes from './growEnvironments';
import scheduleRoutes from './schedule';
import environmentOverviewRoutes from './environmentOverview';

const router: Router = Router();

// Mount routes
router.use('/auth', authRoutes);
router.use('/plants', plantRoutes);
router.use('/journal', journalRoutes);
router.use('/plant-profiles', plantProfileRoutes);
router.use('/seasonal-tips', seasonalTipRoutes);
router.use('/feeding-schedule-templates', feedingScheduleTemplateRoutes);
router.use('/zones', zoneRoutes);
router.use('/care-history', careHistoryRoutes);

// Phase 3 routes
router.use('/questions', questionRoutes);
router.use('/answers', answerRoutes);
router.use('/gardens', gardenRoutes);
router.use('/recommendations', recommendationRoutes);
router.use('/companions', companionRoutes);

// Queue Service routes
router.use('/ai-tasks', aiTaskRoutes);

// Notification routes
router.use('/notifications', notificationRoutes);

// Admin routes
router.use('/admin', adminRoutes);

// Analysis Usage routes
router.use('/analysis-usage', analysisUsageRoutes);

// Grow Tracking routes
router.use('/grows', growRoutes);
router.use('/grow-logs', growLogRoutes);
router.use('/nutrients', nutrientRoutes);
router.use('/grow-nutrients', growNutrientRoutes);
router.use('/grow-harvests', growHarvestRoutes);
router.use('/grow-analyses', growAnalysesRoutes);
router.use('/grow-environments', growEnvironmentRoutes);

// Schedule routes
router.use('/schedule', scheduleRoutes);

// Environment Overview routes
router.use('/environment-overview', environmentOverviewRoutes);

export default router;

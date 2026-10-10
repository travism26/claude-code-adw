import { getSequelize } from '../config/sequelize';
import { User } from './User';
import { Plant } from './Plant';
import { JournalEntry } from './JournalEntry';
import { Reminder } from './Reminder';
import { PlantProfile } from './PlantProfile';
import { SeasonalTip } from './SeasonalTip';
import { CareHistory } from './CareHistory';
import { Question } from './Question';
import { Answer } from './Answer';
import { Vote } from './Vote';
import { Garden } from './Garden';
import { Plot } from './Plot';
import { Recommendation } from './Recommendation';
import { PlantCompanion } from './PlantCompanion';
import { AITask } from './AITask';
import { Notification } from './Notification';
import { GardenAnalysis } from './GardenAnalysis';
import { AnalysisUsage } from './AnalysisUsage';
import { Grow } from './Grow';
import { GrowLog } from './GrowLog';
import { GrowLogEnvironment } from './GrowLogEnvironment';
import { GrowLogPhoto } from './GrowLogPhoto';
import { Nutrient } from './Nutrient';
import { GrowNutrient } from './GrowNutrient';
import { GrowHarvest } from './GrowHarvest';
import { GrowAnalysis } from './GrowAnalysis';
import { GrowEnvironment } from './GrowEnvironment';
import { ScheduledEvent } from './ScheduledEvent';
import { FeedingScheduleTemplate } from './FeedingScheduleTemplate';
import { FeedingScheduleTemplateWeek } from './FeedingScheduleTemplateWeek';
import { FeedingScheduleTemplateWeekNutrient } from './FeedingScheduleTemplateWeekNutrient';
import { GrowFeedingSchedule } from './GrowFeedingSchedule';
import { GrowFeedingWeek } from './GrowFeedingWeek';
import { GrowFeedingWeekNutrient } from './GrowFeedingWeekNutrient';
import { FeedEvent } from './FeedEvent';
import { Sequelize } from 'sequelize';

// Initialize models with Sequelize instance
export async function initializeModels(customSequelize?: Sequelize) {
  const quiet = !!process.env.TEST_QUIET;
  if (!quiet) console.log('Initializing database models...');
  const sequelize = customSequelize || (await getSequelize());

  // Initialize models in dependency order
  User.initSchema(sequelize);
  Plant.initSchema(sequelize);
  JournalEntry.initSchema(sequelize);
  Reminder.initSchema(sequelize);
  PlantProfile.initSchema(sequelize);
  SeasonalTip.initSchema(sequelize);
  CareHistory.initSchema(sequelize);
  Question.initSchema(sequelize);
  Answer.initSchema(sequelize);
  Vote.initSchema(sequelize);
  Garden.initSchema(sequelize);
  Plot.initSchema(sequelize);
  Recommendation.initSchema(sequelize);
  PlantCompanion.initSchema(sequelize);
  AITask.initSchema(sequelize);
  Notification.initSchema(sequelize);
  GardenAnalysis.initSchema(sequelize);
  AnalysisUsage.initSchema(sequelize);
  GrowEnvironment.initSchema(sequelize);
  Grow.initSchema(sequelize);
  GrowLog.initSchema(sequelize);
  GrowLogEnvironment.initSchema(sequelize);
  GrowLogPhoto.initSchema(sequelize);
  Nutrient.initSchema(sequelize);
  GrowNutrient.initSchema(sequelize);
  GrowHarvest.initSchema(sequelize);
  GrowAnalysis.initSchema(sequelize);
  ScheduledEvent.initSchema(sequelize);
  FeedingScheduleTemplate.initSchema(sequelize);
  FeedingScheduleTemplateWeek.initSchema(sequelize);
  FeedingScheduleTemplateWeekNutrient.initSchema(sequelize);
  GrowFeedingSchedule.initSchema(sequelize);
  GrowFeedingWeek.initSchema(sequelize);
  GrowFeedingWeekNutrient.initSchema(sequelize);
  FeedEvent.initSchema(sequelize);

  if (!quiet) console.log('Setting up model associations...');

  // User -> Plant associations
  User.hasMany(Plant, {
    foreignKey: 'user_id',
    as: 'plants',
    onDelete: 'CASCADE',
  });

  // Plant -> JournalEntry associations
  Plant.hasMany(JournalEntry, {
    foreignKey: 'plant_id',
    as: 'journalEntries',
    onDelete: 'CASCADE',
  });

  // User -> Reminder associations
  User.hasMany(Reminder, {
    foreignKey: 'user_id',
    as: 'reminders',
    onDelete: 'CASCADE',
  });

  // Plant -> Reminder associations
  Plant.hasMany(Reminder, {
    foreignKey: 'plant_id',
    as: 'reminders',
    onDelete: 'CASCADE',
  });

  // Reminder -> User associations
  Reminder.belongsTo(User, {
    foreignKey: 'user_id',
    as: 'user',
  });

  // Reminder -> Plant associations
  Reminder.belongsTo(Plant, {
    foreignKey: 'plant_id',
    as: 'plant',
  });

  // PlantProfile -> SeasonalTip associations
  PlantProfile.hasMany(SeasonalTip, {
    foreignKey: 'plant_profile_id',
    as: 'tips',
  });

  // SeasonalTip -> PlantProfile (inverse, so seasonal-tip queries can include the plant)
  SeasonalTip.belongsTo(PlantProfile, {
    foreignKey: 'plant_profile_id',
    as: 'plant_profile',
  });

  // PlantProfile -> Plant associations
  PlantProfile.hasMany(Plant, {
    foreignKey: 'plant_profile_id',
    as: 'plants',
  });

  // Plant -> PlantProfile associations
  Plant.belongsTo(PlantProfile, {
    foreignKey: 'plant_profile_id',
    as: 'plantProfile',
  });

  // CareHistory associations
  Plant.hasMany(CareHistory, {
    foreignKey: 'plant_id',
    as: 'careHistory',
    onDelete: 'CASCADE',
  });

  CareHistory.belongsTo(Plant, {
    foreignKey: 'plant_id',
    as: 'plant',
  });

  User.hasMany(CareHistory, {
    foreignKey: 'user_id',
    as: 'careHistory',
    onDelete: 'CASCADE',
  });

  CareHistory.belongsTo(User, {
    foreignKey: 'user_id',
    as: 'user',
  });

  // Question associations
  User.hasMany(Question, {
    foreignKey: 'user_id',
    as: 'questions',
    onDelete: 'CASCADE',
  });

  Question.belongsTo(User, {
    foreignKey: 'user_id',
    as: 'author',
  });

  Question.hasMany(Answer, {
    foreignKey: 'question_id',
    as: 'answers',
  });

  // Answer associations
  Answer.belongsTo(Question, {
    foreignKey: 'question_id',
    as: 'question',
  });

  Answer.belongsTo(User, {
    foreignKey: 'user_id',
    as: 'author',
  });

  User.hasMany(Answer, {
    foreignKey: 'user_id',
    as: 'answers',
    onDelete: 'CASCADE',
  });

  Answer.hasMany(Vote, {
    foreignKey: 'answer_id',
    as: 'votes',
  });

  // Vote associations
  Vote.belongsTo(Answer, {
    foreignKey: 'answer_id',
    as: 'answer',
  });

  Vote.belongsTo(User, {
    foreignKey: 'user_id',
    as: 'user',
  });

  User.hasMany(Vote, {
    foreignKey: 'user_id',
    as: 'votes',
    onDelete: 'CASCADE',
  });

  // Garden associations
  User.hasMany(Garden, {
    foreignKey: 'user_id',
    as: 'gardens',
    onDelete: 'CASCADE',
  });

  Garden.belongsTo(User, {
    foreignKey: 'user_id',
    as: 'owner',
  });

  Garden.hasMany(Plot, {
    foreignKey: 'garden_id',
    as: 'plots',
  });

  // Plot associations
  Plot.belongsTo(Garden, {
    foreignKey: 'garden_id',
    as: 'garden',
  });

  Plot.belongsTo(PlantProfile, {
    foreignKey: 'plant_profile_id',
    as: 'plantProfile',
  });

  PlantProfile.hasMany(Plot, {
    foreignKey: 'plant_profile_id',
    as: 'plots',
  });

  // Recommendation associations
  User.hasMany(Recommendation, {
    foreignKey: 'user_id',
    as: 'recommendations',
    onDelete: 'CASCADE',
  });

  Recommendation.belongsTo(User, {
    foreignKey: 'user_id',
    as: 'user',
  });

  Recommendation.belongsTo(Plant, {
    foreignKey: 'plant_id',
    as: 'plant',
  });

  Plant.hasMany(Recommendation, {
    foreignKey: 'plant_id',
    as: 'recommendations',
    onDelete: 'SET NULL',
  });

  // PlantCompanion associations
  PlantCompanion.belongsTo(PlantProfile, {
    foreignKey: 'plant_a_id',
    as: 'plantA',
  });

  PlantCompanion.belongsTo(PlantProfile, {
    foreignKey: 'plant_b_id',
    as: 'plantB',
  });

  PlantProfile.hasMany(PlantCompanion, {
    foreignKey: 'plant_a_id',
    as: 'companionsAsPlantA',
  });

  PlantProfile.hasMany(PlantCompanion, {
    foreignKey: 'plant_b_id',
    as: 'companionsAsPlantB',
  });

  // AITask associations
  User.hasMany(AITask, {
    foreignKey: 'user_id',
    as: 'aiTasks',
    onDelete: 'SET NULL',
  });

  AITask.belongsTo(User, {
    foreignKey: 'user_id',
    as: 'user',
  });

  Plant.hasMany(AITask, {
    foreignKey: 'plant_id',
    as: 'aiTasks',
    onDelete: 'SET NULL',
  });

  AITask.belongsTo(Plant, {
    foreignKey: 'plant_id',
    as: 'plant',
  });

  // Notification associations
  User.hasMany(Notification, {
    foreignKey: 'user_id',
    as: 'notifications',
    onDelete: 'CASCADE',
  });

  Notification.belongsTo(User, {
    foreignKey: 'user_id',
    as: 'user',
  });

  // GardenAnalysis associations
  Garden.hasMany(GardenAnalysis, {
    foreignKey: 'garden_id',
    as: 'analyses',
    onDelete: 'CASCADE',
  });

  GardenAnalysis.belongsTo(Garden, {
    foreignKey: 'garden_id',
    as: 'garden',
  });

  User.hasMany(GardenAnalysis, {
    foreignKey: 'user_id',
    as: 'gardenAnalyses',
    onDelete: 'SET NULL',
  });

  GardenAnalysis.belongsTo(User, {
    foreignKey: 'user_id',
    as: 'user',
  });

  AITask.hasMany(GardenAnalysis, {
    foreignKey: 'ai_task_id',
    as: 'gardenAnalyses',
    onDelete: 'SET NULL',
  });

  GardenAnalysis.belongsTo(AITask, {
    foreignKey: 'ai_task_id',
    as: 'aiTask',
  });

  // AnalysisUsage associations
  User.hasMany(AnalysisUsage, {
    foreignKey: 'user_id',
    as: 'analysisUsage',
    onDelete: 'CASCADE',
  });

  AnalysisUsage.belongsTo(User, {
    foreignKey: 'user_id',
    as: 'user',
  });

  // GrowEnvironment associations
  User.hasMany(GrowEnvironment, {
    foreignKey: 'user_id',
    as: 'growEnvironments',
    onDelete: 'CASCADE',
  });

  GrowEnvironment.belongsTo(User, {
    foreignKey: 'user_id',
    as: 'owner',
  });

  GrowEnvironment.hasMany(Grow, {
    foreignKey: 'environment_id',
    as: 'grows',
    onDelete: 'SET NULL',
  });

  // Grow associations
  User.hasMany(Grow, {
    foreignKey: 'user_id',
    as: 'grows',
    onDelete: 'CASCADE',
  });

  Grow.belongsTo(User, {
    foreignKey: 'user_id',
    as: 'owner',
  });

  Grow.belongsTo(GrowEnvironment, {
    foreignKey: 'environment_id',
    as: 'environment',
  });

  Grow.hasMany(GrowLog, {
    foreignKey: 'grow_id',
    as: 'logs',
    onDelete: 'CASCADE',
  });

  // GrowLog associations
  GrowLog.belongsTo(Grow, {
    foreignKey: 'grow_id',
    as: 'grow',
  });

  GrowLog.hasOne(GrowLogEnvironment, {
    foreignKey: 'grow_log_id',
    as: 'environment',
    onDelete: 'CASCADE',
  });

  GrowLog.hasMany(GrowLogPhoto, {
    foreignKey: 'grow_log_id',
    as: 'photos',
    onDelete: 'CASCADE',
  });

  // GrowLogEnvironment associations
  GrowLogEnvironment.belongsTo(GrowLog, {
    foreignKey: 'grow_log_id',
    as: 'growLog',
  });

  // GrowLogPhoto associations
  GrowLogPhoto.belongsTo(GrowLog, {
    foreignKey: 'grow_log_id',
    as: 'growLog',
  });

  // Nutrient associations
  User.hasMany(Nutrient, {
    foreignKey: 'user_id',
    as: 'nutrients',
    onDelete: 'CASCADE',
  });

  Nutrient.belongsTo(User, {
    foreignKey: 'user_id',
    as: 'owner',
  });

  // Grow <-> Nutrient many-to-many through GrowNutrient
  Grow.belongsToMany(Nutrient, {
    through: GrowNutrient,
    foreignKey: 'grow_id',
    otherKey: 'nutrient_id',
    as: 'nutrients',
  });

  Nutrient.belongsToMany(Grow, {
    through: GrowNutrient,
    foreignKey: 'nutrient_id',
    otherKey: 'grow_id',
    as: 'grows',
  });

  // GrowNutrient associations (junction table)
  GrowNutrient.belongsTo(Grow, {
    foreignKey: 'grow_id',
    as: 'grow',
  });

  GrowNutrient.belongsTo(Nutrient, {
    foreignKey: 'nutrient_id',
    as: 'nutrient',
  });

  // GrowHarvest associations
  Grow.hasOne(GrowHarvest, {
    foreignKey: 'grow_id',
    as: 'harvest',
    onDelete: 'CASCADE',
  });

  GrowHarvest.belongsTo(Grow, {
    foreignKey: 'grow_id',
    as: 'grow',
  });

  // GrowAnalysis associations
  Grow.hasMany(GrowAnalysis, {
    foreignKey: 'grow_id',
    as: 'analyses',
    onDelete: 'CASCADE',
  });

  User.hasMany(GrowAnalysis, {
    foreignKey: 'user_id',
    as: 'growAnalyses',
    onDelete: 'CASCADE',
  });

  AITask.hasMany(GrowAnalysis, {
    foreignKey: 'ai_task_id',
    as: 'growAnalyses',
    onDelete: 'SET NULL',
  });

  GrowAnalysis.belongsTo(Grow, {
    foreignKey: 'grow_id',
    as: 'grow',
  });

  GrowAnalysis.belongsTo(User, {
    foreignKey: 'user_id',
    as: 'user',
  });

  GrowAnalysis.belongsTo(AITask, {
    foreignKey: 'ai_task_id',
    as: 'aiTask',
  });

  // ScheduledEvent associations
  User.hasMany(ScheduledEvent, {
    foreignKey: 'user_id',
    as: 'scheduledEvents',
    onDelete: 'CASCADE',
  });

  ScheduledEvent.belongsTo(User, {
    foreignKey: 'user_id',
    as: 'user',
  });

  GrowEnvironment.hasMany(ScheduledEvent, {
    foreignKey: 'environment_id',
    as: 'scheduledEvents',
    onDelete: 'SET NULL',
  });

  ScheduledEvent.belongsTo(GrowEnvironment, {
    foreignKey: 'environment_id',
    as: 'environment',
  });

  // Feeding-schedule template associations
  FeedingScheduleTemplate.hasMany(FeedingScheduleTemplateWeek, {
    foreignKey: 'template_id',
    as: 'weeks',
    onDelete: 'CASCADE',
  });
  FeedingScheduleTemplateWeek.belongsTo(FeedingScheduleTemplate, {
    foreignKey: 'template_id',
    as: 'template',
  });
  FeedingScheduleTemplateWeek.hasMany(FeedingScheduleTemplateWeekNutrient, {
    foreignKey: 'template_week_id',
    as: 'weekNutrients',
    onDelete: 'CASCADE',
  });
  FeedingScheduleTemplateWeekNutrient.belongsTo(FeedingScheduleTemplateWeek, {
    foreignKey: 'template_week_id',
    as: 'week',
  });
  FeedingScheduleTemplateWeekNutrient.belongsTo(Nutrient, {
    foreignKey: 'nutrient_id',
    as: 'nutrient',
  });
  FeedingScheduleTemplate.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

  // Per-grow feeding-schedule associations
  Grow.hasOne(GrowFeedingSchedule, {
    foreignKey: 'grow_id',
    as: 'feedingSchedule',
    onDelete: 'CASCADE',
  });
  GrowFeedingSchedule.belongsTo(Grow, { foreignKey: 'grow_id', as: 'grow' });
  GrowFeedingSchedule.hasMany(GrowFeedingWeek, {
    foreignKey: 'grow_feeding_schedule_id',
    as: 'weeks',
    onDelete: 'CASCADE',
  });
  GrowFeedingWeek.belongsTo(GrowFeedingSchedule, {
    foreignKey: 'grow_feeding_schedule_id',
    as: 'schedule',
  });
  GrowFeedingWeek.hasMany(GrowFeedingWeekNutrient, {
    foreignKey: 'grow_feeding_week_id',
    as: 'weekNutrients',
    onDelete: 'CASCADE',
  });
  GrowFeedingWeekNutrient.belongsTo(GrowFeedingWeek, {
    foreignKey: 'grow_feeding_week_id',
    as: 'week',
  });
  GrowFeedingWeekNutrient.belongsTo(Nutrient, {
    foreignKey: 'nutrient_id',
    as: 'nutrient',
  });

  // Feed-event associations (plan ↔ log)
  GrowFeedingSchedule.hasMany(FeedEvent, {
    foreignKey: 'grow_feeding_schedule_id',
    as: 'feedEvents',
    onDelete: 'CASCADE',
  });
  FeedEvent.belongsTo(GrowFeedingSchedule, {
    foreignKey: 'grow_feeding_schedule_id',
    as: 'schedule',
  });
  GrowFeedingWeek.hasOne(FeedEvent, {
    foreignKey: 'grow_feeding_week_id',
    as: 'feedEvent',
    onDelete: 'SET NULL',
  });
  FeedEvent.belongsTo(GrowFeedingWeek, {
    foreignKey: 'grow_feeding_week_id',
    as: 'week',
  });
  FeedEvent.belongsTo(GrowLog, {
    foreignKey: 'grow_log_id',
    as: 'growLog',
  });

  if (!quiet) console.log('Model initialization complete');
  return {
    User,
    Plant,
    JournalEntry,
    Reminder,
    PlantProfile,
    SeasonalTip,
    CareHistory,
    Question,
    Answer,
    Vote,
    Garden,
    Plot,
    Recommendation,
    PlantCompanion,
    AITask,
    Notification,
    GardenAnalysis,
    AnalysisUsage,
    GrowEnvironment,
    Grow,
    GrowLog,
    GrowLogEnvironment,
    GrowLogPhoto,
    Nutrient,
    GrowNutrient,
    GrowHarvest,
    GrowAnalysis,
    ScheduledEvent,
    FeedingScheduleTemplate,
    FeedingScheduleTemplateWeek,
    FeedingScheduleTemplateWeekNutrient,
    GrowFeedingSchedule,
    GrowFeedingWeek,
    GrowFeedingWeekNutrient,
    FeedEvent,
    sequelize
  };
}

export {
  User,
  Plant,
  JournalEntry,
  Reminder,
  PlantProfile,
  SeasonalTip,
  CareHistory,
  Question,
  Answer,
  Vote,
  Garden,
  Plot,
  Recommendation,
  PlantCompanion,
  AITask,
  Notification,
  GardenAnalysis,
  AnalysisUsage,
  GrowEnvironment,
  Grow,
  GrowLog,
  GrowLogEnvironment,
  GrowLogPhoto,
  Nutrient,
  GrowNutrient,
  GrowHarvest,
  GrowAnalysis,
  ScheduledEvent,
  FeedingScheduleTemplate,
  FeedingScheduleTemplateWeek,
  FeedingScheduleTemplateWeekNutrient,
  GrowFeedingSchedule,
  GrowFeedingWeek,
  GrowFeedingWeekNutrient,
  FeedEvent
};

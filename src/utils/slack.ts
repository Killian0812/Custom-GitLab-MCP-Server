import logger from './logger';
import { ReviewData } from '../types/review.types';

const sendReviewCompletedNotification = async (reviewData: ReviewData): Promise<void> => {
  try {
    // TODO: Implement Slack notification
    logger.info('Slack notification would be sent here', { reviewData });
  } catch (error) {
    logger.error('Error sending Slack notification:', error);
    throw error;
  }
};

const sendErrorMessage = async (message: string): Promise<void> => {
  try {
    // TODO: Implement Slack error notification
    logger.error('Slack error notification would be sent here:', { message });
  } catch (error) {
    logger.error('Error sending Slack error notification:', error);
    throw error;
  }
};

export default {
  sendReviewCompletedNotification,
  sendErrorMessage,
}; 
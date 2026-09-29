import { ProviderError } from '@shared/types/domain';

/** Turns any thrown value into a short, friendly sentence. Stack traces never reach the UI. */
export function describeError(error: unknown, subject: string): string {
  if (error instanceof ProviderError) {
    switch (error.code) {
      case 'network':
        return `Couldn't reach ${subject}. Check your internet connection.`;
      case 'auth':
        return `${subject} rejected the credentials. Check your API key in Settings.`;
      case 'rate-limit':
        return `${subject} is rate limiting requests. Try again in a moment.`;
      case 'not-configured':
        return `${subject} isn't set up yet.`;
      case 'not-found':
        return `${subject} couldn't find that.`;
      case 'aborted':
        return 'Cancelled.';
      default:
        return `${subject} returned an unexpected response.`;
    }
  }
  return `Something went wrong with ${subject}.`;
}

export function isTransient(error: unknown): boolean {
  return error instanceof ProviderError && (error.code === 'network' || error.code === 'rate-limit');
}

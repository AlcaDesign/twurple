import { HttpStatusCodeError, TwitchApiCallType } from 'twitch-api-call';
import type { UserIdResolvable } from 'twitch-common';
import { extractUserId, rtfm } from 'twitch-common';
import { BaseApi } from '../../BaseApi';
import { HelixPaginatedRequest } from '../HelixPaginatedRequest';
import { HelixPaginatedRequestWithTotal } from '../HelixPaginatedRequestWithTotal';
import type { HelixPaginatedResult, HelixPaginatedResultWithTotal } from '../HelixPaginatedResult';
import { createPaginatedResult, createPaginatedResultWithTotal } from '../HelixPaginatedResult';
import type { HelixPaginatedResponse, HelixPaginatedResponseWithTotal, HelixResponse } from '../HelixResponse';
import type { HelixSubscriptionData } from './HelixSubscription';
import { HelixSubscription } from './HelixSubscription';
import type { HelixSubscriptionEventData } from './HelixSubscriptionEvent';
import { HelixSubscriptionEvent } from './HelixSubscriptionEvent';
import type { HelixUserSubscriptionData } from './HelixUserSubscription';
import { HelixUserSubscription } from './HelixUserSubscription';

/**
 * The Helix API methods that deal with subscriptions.
 *
 * Can be accessed using `client.helix.subscriptions` on an {@ApiClient} instance.
 *
 * ## Example
 * ```ts
 * const api = new ApiClient(new StaticAuthProvider(clientId, accessToken));
 * const subscription = await api.helix.subscriptions.getSubscriptionForUser('61369223', '125328655');
 * ```
 */
@rtfm('twitch', 'HelixSubscriptionApi')
export class HelixSubscriptionApi extends BaseApi {
	/**
	 * Retrieves a list of all subscriptions to a given broadcaster.
	 *
	 * @param broadcaster The broadcaster to list subscriptions to.
	 */
	async getSubscriptions(broadcaster: UserIdResolvable): Promise<HelixPaginatedResultWithTotal<HelixSubscription>> {
		const result = await this._client.callApi<HelixPaginatedResponseWithTotal<HelixSubscriptionData>>({
			url: 'subscriptions',
			scope: 'channel:read:subscriptions',
			type: TwitchApiCallType.Helix,
			query: {
				broadcaster_id: extractUserId(broadcaster)
			}
		});

		return createPaginatedResultWithTotal(result, HelixSubscription, this._client);
	}

	/**
	 * Creates a paginator for all subscriptions to a given broadcaster.
	 *
	 * @param broadcaster The broadcaster to list subscriptions to.
	 */
	getSubscriptionsPaginated(
		broadcaster: UserIdResolvable
	): HelixPaginatedRequestWithTotal<HelixSubscriptionData, HelixSubscription> {
		return new HelixPaginatedRequestWithTotal(
			{
				url: 'subscriptions',
				scope: 'channel:read:subscriptions',
				query: {
					broadcaster_id: extractUserId(broadcaster)
				}
			},
			this._client,
			(data: HelixSubscriptionData) => new HelixSubscription(data, this._client)
		);
	}

	/**
	 * Retrieves the subset of the given user list that is subscribed to the given broadcaster.
	 *
	 * @param broadcaster The broadcaster to find subscriptions to.
	 * @param users The users that should be checked for subscriptions.
	 */
	async getSubscriptionsForUsers(
		broadcaster: UserIdResolvable,
		users: UserIdResolvable[]
	): Promise<HelixSubscription[]> {
		const result = await this._client.callApi<HelixResponse<HelixSubscriptionData>>({
			url: 'subscriptions',
			scope: 'channel:read:subscriptions',
			type: TwitchApiCallType.Helix,
			query: {
				broadcaster_id: extractUserId(broadcaster),
				user_id: users.map(extractUserId)
			}
		});

		return result.data.map(data => new HelixSubscription(data, this._client));
	}

	/**
	 * Retrieves the subscription data for a given user to a given broadcaster.
	 *
	 * This checks with the authorization of a broadcaster.
	 * If you only have the authorization of a user, check {@HelixSubscriptionApi#checkUserSubscription}.
	 *
	 * @param broadcaster The broadcaster to check.
	 * @param user The user to check.
	 */
	async getSubscriptionForUser(
		broadcaster: UserIdResolvable,
		user: UserIdResolvable
	): Promise<HelixSubscription | null> {
		const list = await this.getSubscriptionsForUsers(broadcaster, [user]);
		return list.length ? list[0] : null;
	}

	/**
	 * Retrieves the most recent subscription events for a given broadcaster.
	 *
	 * @param broadcaster The broadcaster to retrieve subscription events for.
	 */
	async getSubscriptionEventsForBroadcaster(
		broadcaster: UserIdResolvable
	): Promise<HelixPaginatedResult<HelixSubscriptionEvent>> {
		return this._getSubscriptionEvents('broadcaster_id', extractUserId(broadcaster));
	}

	/**
	 * Creates a paginator for the recent subscription events for a given broadcaster.
	 *
	 * @param broadcaster The broadcaster to retrieve subscription events for.
	 */
	getSubscriptionEventsForBroadcasterPaginated(
		broadcaster: UserIdResolvable
	): HelixPaginatedRequest<HelixSubscriptionEventData, HelixSubscriptionEvent> {
		return new HelixPaginatedRequest(
			{
				url: 'subscriptions/events',
				scope: 'channel:read:subscriptions',
				query: {
					broadcaster_id: extractUserId(broadcaster)
				}
			},
			this._client,
			(data: HelixSubscriptionEventData) => new HelixSubscriptionEvent(data, this._client)
		);
	}

	/**
	 * Retrieves a single subscription event by ID.
	 *
	 * @param id The event ID.
	 */
	async getSubscriptionEventById(id: string): Promise<HelixSubscriptionEvent | null> {
		const events = await this._getSubscriptionEvents('id', id);
		return events.data[0] ?? null;
	}

	/**
	 * Checks if a given user is subscribed to a given broadcaster. Returns null if not subscribed.
	 *
	 * This checks with the authorization of a user.
	 * If you only have the authorization of a broadcaster, check {@HelixSubscriptionApi#getSubscriptionForUser}.
	 *
	 * @param user The broadcaster to check the user's subscription for.
	 * @param broadcaster The user to check.
	 */
	async checkUserSubscription(
		user: UserIdResolvable,
		broadcaster: UserIdResolvable
	): Promise<HelixUserSubscription | null> {
		try {
			const result = await this._client.callApi<HelixResponse<HelixUserSubscriptionData>>({
				type: TwitchApiCallType.Helix,
				url: 'subscriptions/user',
				scope: 'user:read:subscriptions',
				query: {
					broadcaster_id: extractUserId(broadcaster),
					user_id: extractUserId(user)
				}
			});

			return new HelixUserSubscription(result.data[0], this._client);
		} catch (e) {
			if (e instanceof HttpStatusCodeError && e.statusCode === 404) {
				return null;
			}

			throw e;
		}
	}

	private async _getSubscriptionEvents(by: 'broadcaster_id' | 'id', id: string) {
		const result = await this._client.callApi<HelixPaginatedResponse<HelixSubscriptionEventData>>({
			type: TwitchApiCallType.Helix,
			url: 'subscriptions/events',
			scope: 'channel:read:subscriptions',
			query: {
				[by]: id
			}
		});

		return createPaginatedResult(result, HelixSubscriptionEvent, this._client);
	}
}

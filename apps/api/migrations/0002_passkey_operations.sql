CREATE TABLE `passkey_operation` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`session_id` text NOT NULL,
	`action` text NOT NULL,
	`target_passkey_id` text,
	`challenge` text NOT NULL,
	`registration_challenge` text,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`reauthenticated_at` integer,
	`authenticating_passkey_id` text,
	`consumed_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`session_id`) REFERENCES `session`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "passkey_operation_action_target" CHECK(("passkey_operation"."action" = 'add' AND "passkey_operation"."target_passkey_id" IS NULL) OR ("passkey_operation"."action" = 'delete' AND "passkey_operation"."target_passkey_id" IS NOT NULL)),
	CONSTRAINT "passkey_operation_reauthentication" CHECK(("passkey_operation"."reauthenticated_at" IS NULL AND "passkey_operation"."authenticating_passkey_id" IS NULL AND "passkey_operation"."consumed_at" IS NULL) OR ("passkey_operation"."reauthenticated_at" IS NOT NULL AND "passkey_operation"."authenticating_passkey_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `passkey_operation_session_idx` ON `passkey_operation` (`session_id`);--> statement-breakpoint
CREATE INDEX `passkey_operation_expires_idx` ON `passkey_operation` (`expires_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `passkey_operation_challenge_unique` ON `passkey_operation` (`challenge`);
-- Myfnt 2.14.16 Final Database Blueprint
-- Target: MySQL 8.4 / utf8mb4
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS=0;

CREATE TABLE IF NOT EXISTS `companies` (
  `id` CHAR(36) NOT NULL,
  `company_no` BIGINT UNSIGNED NOT NULL,
  `founder_user_id` CHAR(36) NULL,
  `category` VARCHAR(40) NOT NULL,
  `name` VARCHAR(160) NOT NULL,
  `description` TEXT NULL,
  `city` VARCHAR(100) NULL,
  `address` VARCHAR(500) NULL,
  `phone_1` VARCHAR(32) NULL,
  `phone_2` VARCHAR(32) NULL,
  `logo_object_key` VARCHAR(255) NULL,
  `booking_receipt_terms` TEXT NULL,
  `receipt_notes` TEXT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'active',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `deleted_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_companies_company_no` (`company_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `company_message_numbers` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `channel` VARCHAR(20) NOT NULL,
  `phone_e164` VARCHAR(32) NOT NULL,
  `label` VARCHAR(80) NULL,
  `is_default` TINYINT(1) NOT NULL DEFAULT 0,
  `status` VARCHAR(20) NOT NULL DEFAULT 'active',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `deleted_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `uq_message_number_channel_phone` UNIQUE (`company_id`, `channel`, `phone_e164`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `users` (
  `id` CHAR(36) NOT NULL,
  `user_no` BIGINT UNSIGNED NOT NULL,
  `name` VARCHAR(160) NOT NULL,
  `phone_e164` VARCHAR(32) NULL,
  `email` VARCHAR(190) NULL,
  `password_hash` VARCHAR(255) NULL,
  `provider` VARCHAR(30) NULL,
  `avatar_object_key` VARCHAR(255) NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'active',
  `failed_attempts` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  `locked_until` DATETIME(3) NULL,
  `password_updated_at` DATETIME(3) NULL,
  `last_seen_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `deleted_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_user_no` (`user_no`),
  UNIQUE KEY `uq_users_phone_e164` (`phone_e164`),
  UNIQUE KEY `uq_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `user_sessions` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NULL,
  `token_hash` CHAR(64) NOT NULL,
  `device_id` VARCHAR(120) NULL,
  `device_name` VARCHAR(120) NULL,
  `ip_address` VARCHAR(45) NULL,
  `browser` VARCHAR(120) NULL,
  `os` VARCHAR(120) NULL,
  `country` VARCHAR(100) NULL,
  `city` VARCHAR(100) NULL,
  `last_seen_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `expires_at` DATETIME(3) NOT NULL,
  `revoked_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_sessions_token_hash` (`token_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `company_memberships` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `role` VARCHAR(30) NOT NULL DEFAULT 'member',
  `permissions` JSON NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'active',
  `joined_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `deleted_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `uq_membership_company_user` UNIQUE (`company_id`, `user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `company_settings` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `language_tag` VARCHAR(16) NOT NULL DEFAULT 'ar',
  `calendar_kind` VARCHAR(20) NOT NULL DEFAULT 'gregorian',
  `preferred_notification_time` TIME NOT NULL DEFAULT '09:00',
  `currency` CHAR(3) NOT NULL DEFAULT 'YER',
  `sync_mode` VARCHAR(20) NOT NULL DEFAULT 'manual',
  `timezone_name` VARCHAR(64) NOT NULL DEFAULT 'Asia/Aden',
  `deposit_policy` VARCHAR(20) NOT NULL DEFAULT 'optional',
  `allow_booking_overpayment` TINYINT(1) NOT NULL DEFAULT 0,
  `allow_receipt_over_remaining` TINYINT(1) NOT NULL DEFAULT 0,
  `required_fields` JSON NOT NULL DEFAULT (JSON_OBJECT()),
  `show_location_field` TINYINT(1) NOT NULL DEFAULT 0,
  `season_enabled` TINYINT(1) NOT NULL DEFAULT 0,
  `season_name` VARCHAR(100) NULL,
  `season_start_mmdd` CHAR(5) NULL,
  `season_end_mmdd` CHAR(5) NULL,
  `reminder_days` JSON NOT NULL DEFAULT (JSON_ARRAY()),
  `communication_policy` JSON NOT NULL DEFAULT (JSON_OBJECT()),
  `version` BIGINT UNSIGNED NOT NULL DEFAULT 1,
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  CONSTRAINT `uq_company_settings_company` UNIQUE (`company_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `plans` (
  `id` CHAR(36) NOT NULL,
  `code` VARCHAR(40) NOT NULL,
  `name_ar` VARCHAR(100) NOT NULL,
  `name_en` VARCHAR(100) NULL,
  `monthly_price_minor` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `annual_price_minor` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `currency` CHAR(3) NOT NULL DEFAULT 'YER',
  `limits` JSON NOT NULL DEFAULT (JSON_OBJECT()),
  `status` VARCHAR(20) NOT NULL DEFAULT 'active',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_plans_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `company_subscriptions` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `plan_id` CHAR(36) NULL,
  `plan_code_snapshot` VARCHAR(40) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'active',
  `starts_at` DATETIME(3) NOT NULL,
  `expires_at` DATETIME(3) NULL,
  `cancelled_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  CONSTRAINT `uq_active_subscription_period` UNIQUE (`company_id`, `id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `usage_counters` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `metric_code` VARCHAR(60) NOT NULL,
  `period_key` VARCHAR(20) NOT NULL,
  `used_count` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `limit_snapshot` BIGINT UNSIGNED NULL,
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  CONSTRAINT `uq_usage_metric_period` UNIQUE (`company_id`, `metric_code`, `period_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `booking_packages` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `package_no` BIGINT UNSIGNED NULL,
  `name` VARCHAR(140) NOT NULL,
  `icon` VARCHAR(100) NULL,
  `regular_price_minor` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `season_price_minor` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `default_deposit_minor` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `currency` CHAR(3) NOT NULL DEFAULT 'YER',
  `status` VARCHAR(20) NOT NULL DEFAULT 'active',
  `allow_double_booking` TINYINT(1) NOT NULL DEFAULT 0,
  `allow_discount` TINYINT(1) NOT NULL DEFAULT 1,
  `package_version` BIGINT UNSIGNED NOT NULL DEFAULT 1,
  `version` BIGINT UNSIGNED NOT NULL DEFAULT 1,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `deleted_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `uq_package_no` UNIQUE (`company_id`, `package_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `booking_package_versions` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `package_id` CHAR(36) NOT NULL,
  `version_no` BIGINT UNSIGNED NOT NULL,
  `snapshot` JSON NOT NULL,
  `effective_from` DATETIME(3) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  CONSTRAINT `uq_package_version` UNIQUE (`company_id`, `package_id`, `version_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `booking_types` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `code` VARCHAR(60) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `version` BIGINT UNSIGNED NOT NULL DEFAULT 1,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  CONSTRAINT `uq_booking_type_code` UNIQUE (`company_id`, `code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `customers` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `customer_no` BIGINT UNSIGNED NOT NULL,
  `name` VARCHAR(160) NOT NULL,
  `phone_e164` VARCHAR(32) NULL,
  `address` VARCHAR(500) NULL,
  `notes` TEXT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'active',
  `version` BIGINT UNSIGNED NOT NULL DEFAULT 1,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `deleted_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `uq_customer_no` UNIQUE (`company_id`, `customer_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `bookings` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `booking_no` BIGINT UNSIGNED NOT NULL,
  `customer_id` CHAR(36) NOT NULL,
  `event_date` DATE NOT NULL,
  `starts_at` TIME NULL,
  `ends_at` TIME NULL,
  `confirmation` VARCHAR(20) NOT NULL DEFAULT 'confirmed',
  `temporary_expires_at` DATETIME(3) NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'active',
  `amount_minor` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `paid_minor_cache` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `currency` CHAR(3) NOT NULL DEFAULT 'YER',
  `created_by_member_id` CHAR(36) NULL,
  `updated_by_member_id` CHAR(36) NULL,
  `version` BIGINT UNSIGNED NOT NULL DEFAULT 1,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `deleted_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `uq_booking_no` UNIQUE (`company_id`, `booking_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `booking_details` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `booking_id` CHAR(36) NOT NULL,
  `package_id` CHAR(36) NULL,
  `package_version` BIGINT UNSIGNED NULL,
  `customer_name_snapshot` VARCHAR(160) NOT NULL,
  `customer_phone_snapshot` VARCHAR(32) NULL,
  `address_snapshot` VARCHAR(500) NULL,
  `description` TEXT NULL,
  `package_name_snapshot` VARCHAR(140) NULL,
  `package_price_minor_snapshot` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `deposit_minor_snapshot` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `discount_minor` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `surcharge_minor` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `adjustment_reason` TEXT NULL,
  `agreed_total_minor` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `currency` CHAR(3) NOT NULL DEFAULT 'YER',
  `legacy_snapshot_unverified` TINYINT(1) NOT NULL DEFAULT 0,
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  CONSTRAINT `uq_booking_detail_booking` UNIQUE (`company_id`, `booking_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `payments` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `booking_id` CHAR(36) NULL,
  `customer_id` CHAR(36) NULL,
  `receipt_no` BIGINT UNSIGNED NOT NULL,
  `movement_no` BIGINT UNSIGNED NOT NULL,
  `direction` VARCHAR(10) NOT NULL,
  `amount_minor` BIGINT UNSIGNED NOT NULL,
  `currency` CHAR(3) NOT NULL DEFAULT 'YER',
  `payment_method` VARCHAR(30) NOT NULL DEFAULT 'cash',
  `external_reference` VARCHAR(160) NULL,
  `memo` TEXT NULL,
  `tag` VARCHAR(80) NULL,
  `posted_at` DATETIME(3) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'posted',
  `reversal_reason` TEXT NULL,
  `created_by_member_id` CHAR(36) NULL,
  `version` BIGINT UNSIGNED NOT NULL DEFAULT 1,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  CONSTRAINT `uq_receipt_no` UNIQUE (`company_id`, `receipt_no`),
  CONSTRAINT `uq_movement_no` UNIQUE (`company_id`, `movement_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `booking_audit` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `booking_id` CHAR(36) NOT NULL,
  `actor_member_id` CHAR(36) NULL,
  `action` VARCHAR(40) NOT NULL,
  `changed_fields` JSON NULL,
  `reason` TEXT NULL,
  `before_json` JSON NULL,
  `after_json` JSON NULL,
  `source` VARCHAR(30) NOT NULL DEFAULT 'app',
  `happened_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `payment_audit` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `payment_id` CHAR(36) NOT NULL,
  `actor_member_id` CHAR(36) NULL,
  `actor_name_snapshot` VARCHAR(160) NULL,
  `action` VARCHAR(40) NOT NULL,
  `reason` TEXT NULL,
  `before_json` JSON NULL,
  `after_json` JSON NULL,
  `source` VARCHAR(30) NOT NULL DEFAULT 'app',
  `happened_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `wallets` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `name` VARCHAR(140) NOT NULL,
  `currency` CHAR(3) NOT NULL DEFAULT 'YER',
  `kind` VARCHAR(30) NOT NULL DEFAULT 'cash',
  `is_default` TINYINT(1) NOT NULL DEFAULT 0,
  `status` VARCHAR(20) NOT NULL DEFAULT 'active',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ledger_accounts` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `account_no` VARCHAR(40) NOT NULL,
  `name` VARCHAR(160) NOT NULL,
  `type` VARCHAR(30) NOT NULL,
  `parent_id` CHAR(36) NULL,
  `currency` CHAR(3) NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'active',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  CONSTRAINT `uq_ledger_account_no` UNIQUE (`company_id`, `account_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `journal_entries` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `entry_no` BIGINT UNSIGNED NOT NULL,
  `source_type` VARCHAR(30) NOT NULL,
  `source_id` CHAR(36) NULL,
  `entry_date` DATE NOT NULL,
  `memo` TEXT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'posted',
  `created_by_member_id` CHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  CONSTRAINT `uq_journal_entry_no` UNIQUE (`company_id`, `entry_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `journal_lines` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `journal_entry_id` CHAR(36) NOT NULL,
  `account_id` CHAR(36) NOT NULL,
  `wallet_id` CHAR(36) NULL,
  `customer_id` CHAR(36) NULL,
  `debit_minor` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `credit_minor` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `currency` CHAR(3) NOT NULL DEFAULT 'YER',
  `memo` VARCHAR(500) NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `calendar_blocks` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `block_date` DATE NULL,
  `kind` VARCHAR(30) NOT NULL DEFAULT 'busy',
  `title` VARCHAR(160) NULL,
  `pattern_json` JSON NULL,
  `version` BIGINT UNSIGNED NOT NULL DEFAULT 1,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `deleted_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `alert_rules` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `name` VARCHAR(160) NOT NULL,
  `event_code` VARCHAR(60) NOT NULL,
  `when_kind` VARCHAR(10) NOT NULL DEFAULT 'before',
  `interval_unit` VARCHAR(10) NOT NULL DEFAULT 'day',
  `interval_value` INT UNSIGNED NOT NULL DEFAULT 0,
  `recipient_kind` VARCHAR(20) NOT NULL DEFAULT 'staff',
  `channels` JSON NOT NULL DEFAULT (JSON_ARRAY()),
  `customer_template` TEXT NULL,
  `staff_template` TEXT NULL,
  `priority` VARCHAR(20) NOT NULL DEFAULT 'normal',
  `repeat_rule` JSON NULL,
  `enabled` TINYINT(1) NOT NULL DEFAULT 1,
  `version` BIGINT UNSIGNED NOT NULL DEFAULT 1,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `deleted_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `notifications` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NULL,
  `booking_id` CHAR(36) NULL,
  `title` VARCHAR(200) NOT NULL,
  `body` TEXT NULL,
  `kind` VARCHAR(40) NOT NULL,
  `priority` VARCHAR(20) NOT NULL,
  `read_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `notification_jobs` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `booking_id` CHAR(36) NULL,
  `alert_rule_id` CHAR(36) NULL,
  `channel` VARCHAR(20) NOT NULL,
  `scheduled_at` DATETIME(3) NOT NULL,
  `status` VARCHAR(20) NOT NULL,
  `attempts` INT UNSIGNED NOT NULL,
  `last_error` TEXT NULL,
  `sent_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sms_templates` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `name` VARCHAR(140) NOT NULL,
  `channel` VARCHAR(20) NOT NULL,
  `body` TEXT NOT NULL,
  `variables` JSON NULL,
  `status` VARCHAR(20) NOT NULL,
  `created_at` DATETIME(3) NOT NULL,
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sms_messages` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `booking_id` CHAR(36) NULL,
  `customer_id` CHAR(36) NULL,
  `channel` VARCHAR(20) NOT NULL,
  `recipient_e164` VARCHAR(32) NOT NULL,
  `template_id` CHAR(36) NULL,
  `body_snapshot` TEXT NOT NULL,
  `status` VARCHAR(30) NOT NULL,
  `scheduled_at` DATETIME(3) NULL,
  `sent_at` DATETIME(3) NULL,
  `delivered_at` DATETIME(3) NULL,
  `provider_message_id` VARCHAR(190) NULL,
  `cost_units` INT UNSIGNED NOT NULL,
  `idempotency_key` CHAR(36) NOT NULL,
  `error` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `uq_sms_idempotency` UNIQUE (`company_id`, `idempotency_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sms_approvals` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `booking_id` CHAR(36) NULL,
  `alert_rule_id` CHAR(36) NULL,
  `requested_by_member_id` CHAR(36) NULL,
  `scheduled_at` DATETIME(3) NULL,
  `status` VARCHAR(30) NOT NULL,
  `approved_at` DATETIME(3) NULL,
  `idempotency_key` CHAR(36) NOT NULL,
  `created_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `uq_sms_approval_idempotency` UNIQUE (`company_id`, `idempotency_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `company_backups` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `object_key` VARCHAR(255) NOT NULL,
  `size_bytes` BIGINT UNSIGNED NOT NULL,
  `checksum_sha256` CHAR(64) NOT NULL,
  `created_by_member_id` CHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL,
  `expires_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `support_tickets` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `ticket_no` BIGINT UNSIGNED NOT NULL,
  `subject` VARCHAR(190) NOT NULL,
  `status` VARCHAR(30) NOT NULL,
  `priority` VARCHAR(20) NOT NULL,
  `opened_by_user_id` CHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL,
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `uq_support_ticket_no` UNIQUE (`company_id`, `ticket_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `support_messages` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `ticket_id` CHAR(36) NOT NULL,
  `sender_user_id` CHAR(36) NULL,
  `body` TEXT NOT NULL,
  `attachments` JSON NULL,
  `created_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `chat_threads` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `subject` VARCHAR(190) NULL,
  `status` VARCHAR(30) NOT NULL,
  `created_by_user_id` CHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL,
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `chat_messages` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `thread_id` CHAR(36) NOT NULL,
  `sender_user_id` CHAR(36) NULL,
  `body` TEXT NOT NULL,
  `attachments` JSON NULL,
  `created_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `archive_records` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `entity_type` VARCHAR(60) NOT NULL,
  `entity_id` CHAR(36) NOT NULL,
  `snapshot` JSON NOT NULL,
  `archived_by_member_id` CHAR(36) NULL,
  `archived_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `error_logs` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NULL,
  `code` VARCHAR(100) NULL,
  `message` TEXT NOT NULL,
  `context` JSON NULL,
  `created_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sync_change_log` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `cursor_id` BIGINT UNSIGNED NOT NULL,
  `entity_type` VARCHAR(60) NOT NULL,
  `entity_id` CHAR(36) NOT NULL,
  `operation` VARCHAR(20) NOT NULL,
  `entity_version` BIGINT UNSIGNED NOT NULL,
  `changed_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `uq_sync_cursor` UNIQUE (`company_id`, `cursor_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sync_idempotency` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `op_id` CHAR(36) NOT NULL,
  `entity_type` VARCHAR(60) NOT NULL,
  `entity_id` CHAR(36) NOT NULL,
  `operation` VARCHAR(20) NOT NULL,
  `request_hash` CHAR(64) NOT NULL,
  `response_code` SMALLINT UNSIGNED NULL,
  `response_body` JSON NULL,
  `created_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `uq_sync_op` UNIQUE (`company_id`, `op_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sync_conflicts` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `entity_type` VARCHAR(60) NOT NULL,
  `entity_id` CHAR(36) NOT NULL,
  `local_version` BIGINT UNSIGNED NULL,
  `server_version` BIGINT UNSIGNED NULL,
  `local_payload` JSON NULL,
  `server_payload` JSON NULL,
  `resolution` VARCHAR(30) NULL,
  `resolved_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Foreign keys should be added by Laravel migrations in dependency order after data reconciliation.
SET FOREIGN_KEY_CHECKS=1;
CREATE TABLE `app_meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);

INSERT INTO `app_meta` (`key`, `value`) VALUES ('schema_version', '1');

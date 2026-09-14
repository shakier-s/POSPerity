CREATE TABLE `held_sale_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`held_sale_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`quantity` integer NOT NULL,
	`unit_price` real NOT NULL,
	FOREIGN KEY (`held_sale_id`) REFERENCES `held_sales`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `held_sales` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_id` integer NOT NULL,
	`location_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`customer_id` integer,
	`reference` text NOT NULL,
	`total` real NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);

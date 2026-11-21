-- ============================================================================
-- Iloilo City Public Library — Seed Data Migration (MySQL -> PostgreSQL)
-- Run AFTER 001_initial_schema.sql in Supabase Dashboard -> SQL Editor
-- ============================================================================

INSERT INTO public.users (
  id, username, email_display, firstname, lastname, password, created_at,
  failed_attempts, is_locked, lock_until, otp_code, otp_expiry, status, last_seen, role,
  phone_number, reset_token, reset_token_expiry, age, is_active, is_approved,
  otp_enabled, pin_enabled, pin_code, pin_set_at, pin_reset_token, pin_reset_token_expiry,
  gender, school, city, province, education_level, occupation, is_government, office_phone, valid_id_path
) VALUES
(1, '5073a76312c946492b53841c1af2485db0cfa53f5cad9367c41e2a7ac6d80f3d', 'anthonyojera47@gmail.com', 'Anthony', 'Ojera', '$2b$12$4MXJQXL.Y.UHEbw3cp.MCuo2FD1DCZeqJZx6LYCR/VZyuV3Xus/yC', '2026-01-02 06:24:12+00', 0, FALSE, NULL, NULL, NULL, 'active', '2026-10-28 09:09:55+00', 'admin', '09171234567', NULL, NULL, NULL, TRUE, TRUE, FALSE, FALSE, NULL, NULL, NULL, NULL, 'Male', NULL, NULL, NULL, NULL, NULL, FALSE, NULL, NULL),
(73, '128d8758524723c62e95cd4d547ad26b409077f48d51540726c340608217000d', 'juan.delacruz@example.com', 'Juan', 'Dela Cruz', '$2b$12$OdSvc1S/wmrm9EuaEmq5l.yJaC37UN9hOjeQZPqzhjsVPjBzgqS7.', '2026-05-10 05:26:57+00', 0, FALSE, NULL, NULL, NULL, 'active', '2026-05-10 13:30:13+00', 'user', '09182345678', NULL, NULL, '21', TRUE, TRUE, FALSE, FALSE, NULL, NULL, NULL, NULL, 'Male', 'University of the Philippines Visayas', 'Iloilo City', 'Iloilo', 'College', NULL, FALSE, NULL, NULL),
(75, 'fc2f85a9d1e8c4b14e4f0ab402e59967d37ae8cbae9534ab0bbfac843a427da7', 'maria.clara@example.com', 'Maria', 'Clara', '$2b$12$fKZDfPPllSE9.wMU9B7VmeT49ifmgFGaEkHAsar57zyzdHNF1p5Zu', '2026-05-14 05:25:02+00', 0, FALSE, NULL, NULL, NULL, 'offline', '2026-05-17 18:50:37+00', 'user', '09193456789', NULL, NULL, '20', TRUE, TRUE, FALSE, FALSE, NULL, NULL, NULL, NULL, 'Female', 'West Visayas State University', 'Iloilo City', 'Iloilo', 'College', NULL, FALSE, NULL, NULL),
(76, '070ae3b1aa7cac5e9c465c3cb6e47aafb727881e27656e156dd1d3cdb4ebb167', 'keiru.tuerto@iloilolibrary.gov.ph', 'Keiru', 'Tuerto', '$2b$12$ODKIEEPAeqy169fpOhP0xuOmTNjSKOEOTaA47kT2AW6mNPQcTYEDG', '2026-05-17 13:44:37+00', 0, FALSE, NULL, NULL, NULL, 'active', '2026-05-20 18:41:17+00', 'librarian', NULL, NULL, NULL, NULL, TRUE, TRUE, FALSE, FALSE, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, FALSE, NULL, NULL),
(78, 'faf7cfd842a3465e5f5e4e30c2174d29978c5fad3b16300fdcd5745f0320fafd', 'elena.santos@iloilolibrary.gov.ph', 'Elena', 'Santos', '$2b$12$1zEJ9Nat2cdgYCTHWpugy.PBBwJlrIlydXJAahI/fHTtaxA6NwqIO', '2026-08-04 03:18:07+00', 0, FALSE, NULL, NULL, NULL, 'active', '2026-10-28 11:04:27+00', 'librarian', '09204567890', NULL, NULL, NULL, TRUE, TRUE, FALSE, FALSE, NULL, NULL, NULL, NULL, 'Female', NULL, NULL, NULL, NULL, NULL, FALSE, NULL, NULL),
(79, 'b55151559beedc3b07c9f69d3b72dfd4057fe32b7ee2db367450fea592ea126c', 'carlos.reyes@example.com', 'Carlos', 'Reyes', '$2b$12$sJLBVIxFoXxIT.z3uglb4OqTDEFF1USK1h06HwU766O7XdHoWwGQW', '2026-09-29 15:06:35+00', 0, FALSE, NULL, NULL, NULL, 'active', '2026-10-28 11:04:09+00', 'user', '09215678901', NULL, NULL, '23', TRUE, TRUE, FALSE, FALSE, NULL, NULL, NULL, NULL, 'Male', 'Central Philippine University', 'Iloilo City', 'Iloilo', 'Bachelor''s Degree', NULL, FALSE, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.books (
  id, call_number, date_received, class, author, title, isbn,
  edition, page_count, category, source_of_fund, cost_price, publisher, copy_right, subtitle,
  published_date, description, language, thumbnail_url, api_source, is_borrowable, created_at, updated_at
) VALUES
(52, NULL, NULL, 'Philosophy', 'F. Scott Fitzgerald', 'The Life of Justice', '978-1-56619-909-4', NULL, NULL, 'Philosophy & Ethics', NULL, NULL, 'Scribner Classics', NULL, NULL, NULL, NULL, 'en', NULL, NULL, TRUE, '2026-03-03 14:14:51+00', '2026-05-12 06:10:00+00'),
(59, NULL, NULL, 'Historical Fiction', 'Carlos Bulosan', 'America Is in the Heart', '978-0-295-95289-5', NULL, 388, 'Philippine Literature', NULL, NULL, 'University of Washington Press', NULL, 'heelo world', '1986', 'A story of love and social awareness during the American occupation.', 'tl', 'https://books.google.com/books/content?id=-aQ2vMJzYYkC&printsec=frontcover&img=1&zoom=1&edge=curl&source=gbs_api', 'Google Books', FALSE, '2026-03-05 11:28:16+00', '2026-05-12 06:10:00+00'),
(66, NULL, NULL, 'Adventure', 'Paulo Coelho', 'The Pilgrimage', '9780061687457', NULL, NULL, 'Fiction & Literature', NULL, NULL, 'HarperOne', NULL, NULL, '2008-09-02', 'The Pilgrimage paved the way to Paulo Coehlo''s international bestselling novel The Alchemist. In many ways, these two volumes are companions—to truly comprehend one, you must read the other. Step inside this captivating account of Paulo Coehlo''s pilgrimage along the road to Santiago.', 'en', 'https://books.google.com/books/content?id=gn8emAEACAAJ&printsec=frontcover&img=1&zoom=1&source=gbs_api', 'Google Books', TRUE, '2026-03-25 07:45:31+00', '2026-05-12 06:10:00+00'),
(67, '1212.1212', NULL, 'Romance', 'F. Scott Fitzgerald', 'Sleeparalis', '978-3-16-148410-0', NULL, 256, 'Contemporary Fiction', 'donation', 100.00, 'Penguin Classics', '2026', '..Hope you like it', '2.3.2026', 'Enemies to lover and back to enemies', 'en', 'https://covers.openlibrary.org/b/id/15179814-M.jpg', 'Open Library', TRUE, '2026-04-29 03:34:24+00', '2026-05-12 06:10:00+00'),
(69, '1212.1212', '2026-04-25', 'Fantasy', 'J.K. Rowling', 'Harry Potter and the Philosopher''s Stone', '978-0-7475-3269-9', '2nd', 223, 'Fantasy & Young Adult', 'donation', 100.00, 'Bloomsbury Publishing', '2026', 'Mandarin', '1997', 'Harry Potter thinks he is an ordinary boy - until he is rescued by an owl, taken to Hogwarts School of Witchcraft and Wizardry.', 'en', 'https://covers.openlibrary.org/b/id/7355968-M.jpg', 'Open Library', TRUE, '2026-04-29 06:07:50+00', '2026-05-12 06:10:00+00'),
(70, '1212.1212', '2026-04-30', 'Cybersecurity', 'David Kim & Michael G. Solomon', 'Fundamentals of Information Systems Security', '978-1-284-11645-8', '2nd', 538, 'Computer Science & IT', 'donation', 20.00, 'Jones & Bartlett Learning', '2026', 'Mandarin', '2010-11-17', 'Intended for courses in IT security and information assurance, this textbook provides detailed practical information on network and system security.', 'en', 'https://books.google.com/books/content?id=-agjhFspvFMC&printsec=frontcover&img=1&zoom=1&edge=curl&source=gbs_api', 'Google Books', TRUE, '2026-04-29 09:07:31+00', '2026-05-12 06:10:00+00'),
(72, '1212.1212', '2026-05-19', 'Biography', 'Markos Malayalam', 'Neethiyude Patha: The Path of Justice', '978-81-264-1999-2', '2nd', 200, 'Biography & History', 'donation', 100.00, 'DC Books', '2026', 'Markos''s life', '1997', 'According to the 1999 British Major Polar, he published in London in the new book of London, a book of Markos Malayalam.', 'en', 'https://covers.openlibrary.org/b/id/15128897-M.jpg', 'Open Library', TRUE, '2026-05-18 05:57:35+00', '2026-05-18 05:57:35+00'),
(75, NULL, NULL, 'Classics', 'Jane Austen', 'Pride and Prejudice', '978-0-14-143951-8', NULL, 272, 'Classic Literature', NULL, NULL, 'Penguin Classics', NULL, NULL, 'Sep 01, 2005', NULL, NULL, '/cover/143e849ac3dc4f18aa973fccae58d1b0.jpg', 'Open Library', TRUE, '2026-10-27 16:16:58+00', '2026-10-27 16:16:58+00'),
(79, NULL, NULL, 'Mystery', 'Sir Arthur Conan Doyle', 'The Complete Sherlock Holmes', '978-0-00-742026-1', NULL, 1468, 'Mystery & Detective', NULL, NULL, 'Collins Classics', NULL, NULL, '1994', 'The Collins Classics Complete Sherlock Holmes includes all of Sir Arthur Conan Doyle''s much-loved detective stories.', NULL, '/cover/3047db47f35847268135e5f9ced74737.jpg', 'Open Library', TRUE, '2026-10-28 01:52:03+00', '2026-10-28 01:52:03+00')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.book_inventory (id, book_id, volumes, available_copies, damaged_copies, lost_copies, shelf_location, status, created_at) VALUES
(2, 52, 100, 100, 0, 0, 'section b - row 15', 'Available', '2026-03-03 14:14:51+00'),
(11, 59, 100, 100, 0, 0, 'A-Row2', 'Available', '2026-03-05 11:28:16+00'),
(18, 66, 150, 145, 0, 0, NULL, 'Available', '2026-03-25 07:45:31+00'),
(19, 67, 1, 1, 0, 0, 'A-Row 2', 'Available', '2026-04-29 03:34:24+00'),
(21, 69, 50, 38, 10, 2, 'A-Row 2', 'Available', '2026-04-29 06:07:50+00'),
(22, 70, 100, 80, 10, 5, 'A-Row 2', 'Available', '2026-04-29 09:07:31+00'),
(24, 72, 50, 43, 5, 2, 'A-Row 2', 'Available', '2026-05-18 05:57:35+00'),
(27, 75, 1, 1, 0, 0, NULL, 'Available', '2026-10-27 16:16:58+00'),
(30, 79, 1, 1, 0, 0, NULL, 'Available', '2026-10-28 01:52:03+00')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.library_cards (
  id, card_type_category, user_id, firstname, lastname, phone_number, address,
  date_issued, date_return, renewal1_checked, renewal1_date, renewal2_checked, renewal2_date,
  card_type, valid_until, photo_path, registered_by, created_at, updated_at
) VALUES
(20, 'member', NULL, 'Juan', 'Dela Cruz', '09182345678', 'Jaro, Iloilo City', '2026-05-14', '2026-05-15', FALSE, NULL, FALSE, NULL, 'regular', 'May 14, 2027', 'static/uploads/card_photos/member_46041b28bfee42e8a90a6bedbbec9910.jpg', 1, '2026-05-14 12:00:43+00', '2026-05-14 12:00:43+00'),
(21, 'member', 75, 'Maria', 'Clara', '09193456789', 'La Paz, Iloilo City', '2026-05-14', '2026-05-21', TRUE, '2026-05-14', FALSE, NULL, 'regular', 'May 14, 2027', 'static/uploads/card_photos/member_0d2d68d3d1d14e0b8bb5b2609fdd24aa.webp', 1, '2026-05-14 13:31:47+00', '2026-05-14 13:33:36+00')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.library_card_books (id, card_id, book_id, book_title, book_author, book_isbn, quantity, added_at) VALUES
(46, 20, NULL, 'The Life of Justice The Path of Justice Malayalam evio', 'F. Scott Fitzgerald', '1-56619-909-3', 5, '2026-05-14 12:00:43+00'),
(47, 21, 67, 'SLEEPARALIS', 'F. Scott Fitzgerald', '978-3-16-148410-0', 1, '2026-05-14 13:31:47+00'),
(48, 21, 66, 'The Pilgrimage', 'Paulo Coelho', '9780061687457', 1, '2026-05-14 13:31:47+00')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.book_returns (id, card_id, return_date, processed_by, created_at) VALUES
(18, 21, '2026-05-14', 1, '2026-05-14 13:41:19+00')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.book_return_items (id, return_id, card_book_id, book_title, book_author, book_isbn, qty_returned) VALUES
(29, 18, 47, 'SLEEPARALIS', 'F. Scott Fitzgerald', '978-3-16-148410-0', 1),
(30, 18, 48, 'The Pilgrimage', 'Paulo Coelho', '9780061687457', 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.account_requests (id, user_id, username, request_type, reason, status, reviewed_by, reviewed_at, admin_note, created_at, card_id, renewal1_checked, renewal1_date, renewal2_checked, renewal2_date) VALUES
(75, 73, '128d8758524723c62e95cd4d547ad26b409077f48d51540726c340608217000d', 'register', 'New user registration awaiting admin approval.', 'approved', 1, '2026-05-10 13:27:13+00', '', '2026-05-10 13:26:57+00', NULL, NULL, NULL, NULL, NULL),
(77, 75, 'fc2f85a9d1e8c4b14e4f0ab402e59967d37ae8cbae9534ab0bbfac843a427da7', 'register', 'New user registration awaiting admin approval.', 'approved', 1, '2026-05-14 13:26:06+00', '', '2026-05-14 13:25:02+00', NULL, NULL, NULL, NULL, NULL),
(78, 75, 'fc2f85a9d1e8c4b14e4f0ab402e59967d37ae8cbae9534ab0bbfac843a427da7', 'renew', 'No reason provided', 'approved', 1, '2026-05-14 13:33:36+00', 'okay na', '2026-05-14 13:33:22+00', 21, TRUE, '2026-05-14', FALSE, NULL),
(79, 79, 'b55151559beedc3b07c9f69d3b72dfd4057fe32b7ee2db367450fea592ea126c', 'register', 'New user registration awaiting admin approval.', 'approved', 1, '2026-09-29 23:06:58+00', 'nice', '2026-09-29 23:06:35+00', NULL, NULL, NULL, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.announcements (id, title, body, category, pinned, author, target_user_id, created_at, updated_at) VALUES
(2, 'New Arrivals in Fiction Section', 'We are excited to announce that the latest bestsellers and popular fiction titles have arrived! Visit the fiction section to explore new books and reserve your favorites today.', 'general', FALSE, 'Keiru Tuerto (Librarian)', NULL, '2026-03-03 19:17:34+00', NULL),
(3, 'Temporary Closure for Maintenance', 'The library will be closed tomorrow, March 4, 2026, from 8:00 AM to 5:00 PM for scheduled maintenance. We apologize for any inconvenience and encourage you to plan your visits accordingly.', 'urgent', TRUE, 'Keiru Tuerto (Librarian)', NULL, '2026-03-03 19:17:52+00', '2026-03-03 19:32:57+00'),
(4, 'Return Overdue Books', 'Friendly reminder to return any overdue books by the end of this week to avoid late fees. Check your account online to see your borrowed items and due dates.', 'general', FALSE, 'Keiru Tuerto (Librarian)', NULL, '2026-03-03 19:18:18+00', NULL),
(5, 'Library Announcement', E'Please be informed that the library system is now updated. Students are encouraged to return borrowed books on or before the due date to avoid penalties.\n\nIf you wish to borrow new books, you may visit the library or use the library system to check the available inventory.\n\nThank you and have a great day!', 'general', TRUE, 'Anthony Ojera (Admin)', NULL, '2026-03-11 16:34:24+00', '2026-03-11 18:44:22+00'),
(6, 'Library System Update', E'Good day, everyone!\n\nWe would like to inform all users that the library system has been recently updated to improve performance and security. Please report any issues you encounter while using the system to the library staff.\n\nThank you for your cooperation.', 'general', FALSE, 'Anthony Ojera (Admin)', NULL, '2026-03-11 18:44:00+00', NULL),
(70, 'Registration Approved — Welcome!', 'Your registration has been approved by the Admin. You can now log in.', 'general', FALSE, 'Anthony Ojera (Admin)', 73, '2026-05-10 13:27:18+00', NULL),
(78, 'Registration Approved — Welcome!', 'Your registration has been approved by the Admin. You can now log in.', 'general', FALSE, 'Anthony Ojera (Admin)', 75, '2026-05-14 13:26:10+00', NULL),
(79, 'Library Card Renewal — Approved', 'Your library card renewal has been approved. Note: "okay na"', 'general', FALSE, 'Anthony Ojera (Admin)', 75, '2026-05-14 13:33:36+00', NULL),
(81, 'Registration Approved — Welcome!', 'Your registration has been approved by the Admin. You can now log in. Note: "nice"', 'general', FALSE, 'Anthony Ojera (Admin)', 79, '2026-09-29 23:07:00+00', NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.notification_reads (id, user_id, announcement_id, read_at, dismissed) VALUES
(797, 75, 5, '2026-05-14 13:35:41+00', FALSE),
(798, 75, 2, '2026-05-14 13:35:41+00', FALSE),
(799, 75, 3, '2026-05-14 13:35:41+00', FALSE),
(800, 75, 4, '2026-05-14 13:35:41+00', FALSE),
(802, 75, 6, '2026-05-14 13:35:41+00', FALSE),
(805, 75, 70, '2026-05-14 13:35:41+00', FALSE),
(806, 75, 78, '2026-05-14 13:35:41+00', FALSE),
(807, 75, 79, '2026-05-14 13:35:41+00', FALSE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.staff_appearance (id, user_id, theme, language, updated_at) VALUES
(1, 1, 'dark', 'english', '2026-10-01 20:24:32+00'),
(7, 78, 'dark', 'english', '2026-10-28 11:04:25+00')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.system_settings (id, maintenance_enabled, maintenance_message, bypass_role, lockdown_enabled, backup_frequency, updated_at) VALUES
(1, FALSE, 'The library system is currently under scheduled maintenance. We''ll be back shortly. Thank you for your patience.', 'admin', FALSE, 'hourly', '2026-05-30 12:31:25+00')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.backup_logs (id, backup_type, scope, file_name, file_size_bytes, dropbox_path, status, error_message, created_at) VALUES
(5, 'manual', 'Database + System Files', 'backup_2026-05-30_13-56-06.zip.enc', 37744460, '/Iloilo_Public_Library_Backups/backup_2026-05-30_13-56-06.zip.enc', 'success', '', '2026-05-30 13:56:15+00'),
(6, 'manual', 'Database + System Files', 'backup_2026-05-30_13-59-59.zip.enc', 37745036, '/Iloilo_Public_Library_Backups/backup_2026-05-30_13-59-59.zip.enc', 'success', '', '2026-05-30 14:00:08+00'),
(7, 'auto', 'Database + Files', 'backup_2026-05-31_13-00-00.zip.enc', 37748344, '/Iloilo_Public_Library_Backups/backup_2026-05-31_13-00-00.zip.enc', 'success', '', '2026-05-31 13:00:12+00'),
(8, 'auto', 'Database + Files', 'backup_2026-05-31_14-00-00.zip.enc', 37751204, '/Iloilo_Public_Library_Backups/backup_2026-05-31_14-00-00.zip.enc', 'success', '', '2026-05-31 14:00:08+00')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_favorites (id, user_id, book_id, created_at) VALUES
(69, 73, 70, '2026-05-10 13:29:53+00'),
(71, 75, 66, '2026-05-17 18:48:47+00')
ON CONFLICT (id) DO NOTHING;

-- Sync PostgreSQL IDENTITY sequences so new inserts never collide with migrated IDs
SELECT setval(pg_get_serial_sequence('public.users', 'id'), COALESCE((SELECT MAX(id) FROM public.users), 1));
SELECT setval(pg_get_serial_sequence('public.books', 'id'), COALESCE((SELECT MAX(id) FROM public.books), 1));
SELECT setval(pg_get_serial_sequence('public.book_inventory', 'id'), COALESCE((SELECT MAX(id) FROM public.book_inventory), 1));
SELECT setval(pg_get_serial_sequence('public.library_cards', 'id'), COALESCE((SELECT MAX(id) FROM public.library_cards), 1));
SELECT setval(pg_get_serial_sequence('public.library_card_books', 'id'), COALESCE((SELECT MAX(id) FROM public.library_card_books), 1));
SELECT setval(pg_get_serial_sequence('public.book_returns', 'id'), COALESCE((SELECT MAX(id) FROM public.book_returns), 1));
SELECT setval(pg_get_serial_sequence('public.book_return_items', 'id'), COALESCE((SELECT MAX(id) FROM public.book_return_items), 1));
SELECT setval(pg_get_serial_sequence('public.account_requests', 'id'), COALESCE((SELECT MAX(id) FROM public.account_requests), 1));
SELECT setval(pg_get_serial_sequence('public.announcements', 'id'), COALESCE((SELECT MAX(id) FROM public.announcements), 1));
SELECT setval(pg_get_serial_sequence('public.notification_reads', 'id'), COALESCE((SELECT MAX(id) FROM public.notification_reads), 1));
SELECT setval(pg_get_serial_sequence('public.staff_appearance', 'id'), COALESCE((SELECT MAX(id) FROM public.staff_appearance), 1));
SELECT setval(pg_get_serial_sequence('public.backup_logs', 'id'), COALESCE((SELECT MAX(id) FROM public.backup_logs), 1));
SELECT setval(pg_get_serial_sequence('public.user_favorites', 'id'), COALESCE((SELECT MAX(id) FROM public.user_favorites), 1));

-- Ensure employees without availability blocks have full-day availability
UPDATE "Employee"
SET "availability" = '[
  {"dayOfWeek":"mon","blocks":[{"startTime":"00:00","endTime":"23:59"}]},
  {"dayOfWeek":"tue","blocks":[{"startTime":"00:00","endTime":"23:59"}]},
  {"dayOfWeek":"wed","blocks":[{"startTime":"00:00","endTime":"23:59"}]},
  {"dayOfWeek":"thu","blocks":[{"startTime":"00:00","endTime":"23:59"}]},
  {"dayOfWeek":"fri","blocks":[{"startTime":"00:00","endTime":"23:59"}]},
  {"dayOfWeek":"sat","blocks":[{"startTime":"00:00","endTime":"23:59"}]},
  {"dayOfWeek":"sun","blocks":[{"startTime":"00:00","endTime":"23:59"}]}
]'::jsonb
WHERE "availability" IS NULL
   OR jsonb_typeof("availability") <> 'array'
   OR jsonb_array_length("availability") = 0
   OR NOT EXISTS (
     SELECT 1
     FROM jsonb_array_elements("availability") AS day
     WHERE jsonb_typeof(day->'blocks') = 'array'
       AND jsonb_array_length(day->'blocks') > 0
   );

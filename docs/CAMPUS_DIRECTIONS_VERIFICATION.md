# Campus directions verification

Five live ORS responses were fetched on 2026-09-05 using the existing provider. The formatter does not alter geometry, distance, time, or maneuvers. These are regression fixtures, not cached production routes.

Distances below measure each KML pin against the specific instruction’s route leg (arrival distances are to the final route point). Automated tests recalculate them independently. No visual or on-foot verification is claimed.

## College of Medicine, Charles E. Schmidt (BC-71) → College of Engineering and Computer Science (EE-96)

220.6 meters; 3 minutes.

1. From College of Medicine, Charles E. Schmidt, head south for about 9 meters, then turn left
2. Keep right and continue toward College of Engineering and Computer Science.
3. Turn left for about 7 meters, then arrive near College of Engineering and Computer Science.

| KML landmark | Supported relationship | Distance to leg |
| --- | --- | --- |
| College of Engineering and Computer Science (EE-96) | toward | 19.6 m |
| College of Engineering and Computer Science (EE-96) | arrival | 13.0 m |

## Recreation and Fitness Center (RC-91) → Student Services & Food Court (SS-8)

464.6 meters; 6 minutes.

1. From Recreation and Fitness Center, head south
2. Turn left onto Breezeway and continue past Hillel Jewish Life Center.
3. Arrive near Student Services & Food Court, on your left.

| KML landmark | Supported relationship | Distance to leg |
| --- | --- | --- |
| Hillel Jewish Life Center (LY-3A) | past | 14.0 m |
| Student Services & Food Court (SS-8) | arrival_left | 17.8 m |

## S. E. Wimberly Library (LY-3) → Student Union (UN-31)

363.4 meters; 4 minutes.

1. From S. E. Wimberly Library, head south
2. Turn right
3. Turn left and continue past Live Oak Pavilion.
4. Turn left and continue toward Student Union.
5. Arrive near Student Union, on your left.

| KML landmark | Supported relationship | Distance to leg |
| --- | --- | --- |
| Live Oak Pavilion (LO-31B) | past | 0.8 m |
| Student Union (UN-31) | toward | 17.6 m |
| Student Union (UN-31) | arrival_left | 17.6 m |

## Engineering East (EE-96) → Starbucks

722.7 meters; 9 minutes.

1. From Engineering East, head south for about 7 meters, then turn right and continue toward College of Medicine, Charles E. Schmidt.
2. Turn left
3. Turn right
4. Turn right
5. Turn right
6. Keep left
7. Turn right
8. Turn right
9. Turn right and continue toward Ritter Art Gallery.
10. Turn left onto Breezeway and continue toward Starbucks.
11. Arrive near Starbucks, on your right.

| KML landmark | Supported relationship | Distance to leg |
| --- | --- | --- |
| College of Medicine, Charles E. Schmidt (BC-71) | toward | 29.3 m |
| Ritter Art Gallery (AG-39) | toward | 36.3 m |
| Starbucks | toward | 12.2 m |
| Starbucks | arrival_right | 12.2 m |

## Student Union (UN-31) → Bookstore (BK-76)

367.3 meters; 4 minutes.

1. From Student Union, walk toward Live Oak Pavilion.
2. Turn right
3. Turn right
4. Turn left and continue toward Instructional Services.
5. Turn right and continue toward Bookstore.
6. Continue straight for about 12 meters, then arrive near Bookstore, on your left.

| KML landmark | Supported relationship | Distance to leg |
| --- | --- | --- |
| Live Oak Pavilion (LO-31B) | toward | 29.3 m |
| Instructional Services (IS-4) | toward | 36.1 m |
| Bookstore (BK-76) | toward | 32.5 m |
| Bookstore (BK-76) | arrival_left | 30.5 m |

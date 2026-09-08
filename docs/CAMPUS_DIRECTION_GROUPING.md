# Campus direction grouping verification

The same five recorded live ORS routes were re-run through the formatter before and after the grouping change, so the comparison holds route geometry fixed. No new route calculation or KML threshold changes are involved. Automated regression tests require identical landmark evidence, all original left/right maneuvers in order, unchanged route objects, and unchanged final arrival text.

Grouping limits: at most three instructions, both ORS and measured geometry length at most 100 m, displacement/path length at least 0.75, at most 20 m lateral deviation from the endpoint corridor, and no backward movement exceeding 3 m. Waypoints must connect. Named transitions, arrivals, unknown maneuver forms, and intervening validated landmark cues block grouping. All turns remain explicit because a single polyline cannot prove that junctions are absent.

| Route | Before | After | Old display steps grouped |
| --- | --- | --- | --- |
| College of Medicine, Charles E. Schmidt (BC-71) → College of Engineering and Computer Science (EE-96) | 3 | 3 | None |
| Recreation and Fitness Center (RC-91) → Student Services & Food Court (SS-8) | 3 | 3 | None |
| S. E. Wimberly Library (LY-3) → Student Union (UN-31) | 5 | 5 | None |
| Engineering East (EE-96) → Starbucks | 11 | 7 | 2 + 3; 5 + 6 + 7; 8 + 9 |
| Student Union (UN-31) → Bookstore (BK-76) | 6 | 6 | None |

## College of Medicine, Charles E. Schmidt (BC-71) → College of Engineering and Computer Science (EE-96)

Already compact. The remaining long leg and validated destination cue stay distinct; the existing short departure/arrival combinations remain unchanged.


1. From College of Medicine, Charles E. Schmidt, head south a short distance, then turn left
2. Keep right and continue toward College of Engineering and Computer Science.
3. Turn left, continue a short distance, then arrive near College of Engineering and Computer Science.

## Recreation and Fitness Center (RC-91) → Student Services & Food Court (SS-8)

The 67-meter departure is followed by a named Breezeway transition and a roughly 398-meter leg. The named transition, landmark cue, and arrival stay distinct.


1. From Recreation and Fitness Center, head south
2. Turn left onto Breezeway and continue past Hillel Jewish Life Center.
3. Arrive near Student Services & Food Court, on your left.

## S. E. Wimberly Library (LY-3) → Student Union (UN-31)

Adjacent remaining maneuver legs exceed the 100-meter limit, or contain an intervening validated landmark cue. Preserve the turns around Live Oak Pavilion and the approach to Student Union.


1. From S. E. Wimberly Library, head south
2. Turn right
3. Turn left and continue past Live Oak Pavilion.
4. Turn left and continue toward Student Union.
5. Arrive near Student Union, on your left.

## Engineering East (EE-96) → Starbucks

Only three clusters meet all grouping limits. The roughly 123-meter standalone leg, existing long departure, named Breezeway transition, and arrival remain separate. Seven instructions are retained instead of forcing six.

- Old display steps 2, 3 → new step 2: ORS 91.2 m; geometry 91.3 m; corridor deviation 8.7 m; displacement/path ratio 0.92. Contiguous unnamed legs in a short corridor, with no intervening validated landmark instruction; all maneuvers and final landmark wording retained.
- Old display steps 5, 6, 7 → new step 4: ORS 99.0 m; geometry 99.1 m; corridor deviation 13.6 m; displacement/path ratio 0.83. Contiguous unnamed legs in a short corridor, with no intervening validated landmark instruction; all maneuvers and final landmark wording retained.
- Old display steps 8, 9 → new step 5: ORS 64.0 m; geometry 64.0 m; corridor deviation 13.8 m; displacement/path ratio 0.90. Contiguous unnamed legs in a short corridor, with no intervening validated landmark instruction; all maneuvers and final landmark wording retained.

1. From Engineering East, head south a short distance, then turn right and continue toward College of Medicine, Charles E. Schmidt.
2. Turn left; continue a short distance, then turn right.
3. Turn right
4. Turn right; continue a short distance, then keep left; continue a short distance, then turn right.
5. Turn right; continue a short distance, then turn right and continue toward Ritter Art Gallery.
6. Turn left onto Breezeway and continue toward Starbucks.
7. Arrive near Starbucks, on your right.

## Student Union (UN-31) → Bookstore (BK-76)

The two consecutive right-turn legs total roughly 117 meters and bend back (endpoint displacement is only 37% of path length). Other boundaries have validated landmark cues, or the existing straight/arrival combination. No additional grouping is safe under these rules.


1. From Student Union, walk toward Live Oak Pavilion.
2. Turn right
3. Turn right
4. Turn left and continue toward Instructional Services.
5. Turn right and continue toward Bookstore.
6. Continue straight a short distance, then arrive near Bookstore, on your left.

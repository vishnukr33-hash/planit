Planit – Task Management Enhancement Requirements

1. Remove the "Accept Task" button for Users. Tasks assigned to users should be visible immediately without requiring acceptance.

2. For assigned tasks, only the Status field should be editable by the assignee. All other fields (Task Title, Description, Category, Priority, Due Date, Due Time, and Assigned To) should remain read-only. Self-created tasks can be fully edited by the task owner.

3. Display individual productivity metrics for each team member on the Team Tasks page. Productivity should include assigned tasks, completed tasks, pending tasks, overdue tasks, and completion percentage.

4. Task ownership and management should follow the hierarchy:

   * If a Head assigns a task to a Team Lead, the Head should have Edit and Delete permissions for that task.
   * If a Team Lead assigns a task to a User, the Team Lead should have Edit and Delete permissions for that task.
   * Task creators should always have Edit and Delete rights for tasks assigned by them.

5. Add an Excel Export option on both pages, with exported data filtered according to the selected date range:

   * Team Tasks page
   * My Tasks page

   The export should include all visible task details and respect applied filters.

6. Add date-based filtering across the application:

   * Dashboard should support Month-wise and Custom Date Range views, with Month-wise selected as the default view to provide more precise productivity insights.
   * Team Tasks page should support Month-wise and Custom Date Range filtering.
   * My Tasks page should support Month-wise and Custom Date Range filtering.

   All charts, KPIs, productivity metrics, and task listings should update dynamically based on the selected date range.

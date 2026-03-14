// Helper function to remove HTML comments matching certain conditions
export function removeCommentsIf($, { includes }) {
  const includesArray = Array.isArray(includes) ? includes : [includes];

  // Find all comment nodes and remove matching ones
  $("*")
    .contents()
    .filter(function () {
      return this.type === "comment";
    })
    .each(function () {
      const commentText = this.data || "";
      const shouldRemove = includesArray.every((pattern) => commentText.includes(pattern)
      );
      if (shouldRemove) {
        $(this).remove();
      }
    });
}

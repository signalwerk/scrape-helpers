// Traverse the DOM and remove soeme comment nodes
export function removeCommentsIf($, { includes = [] }) {
  // Convert string input to array if necessary
  const includesArray = typeof includes === "string" ? [includes] : includes;

  $("*")
    .contents()
    .each(function () {
      if (this.type === "comment") {
        // Check if comment contains ALL of the specified strings
        const shouldRemove = includesArray.every((text) =>
          this.data.includes(text),
        );

        if (shouldRemove) {
          $(this).remove();
        }
      }
    });
}

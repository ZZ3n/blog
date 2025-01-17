import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"
import { isSimpleSlug } from "./quartz/util/path"

// components shared across all pages
export const sharedPageComponents: SharedLayout = {
  head: Component.Head(),
  header: [],
  footer: Component.Footer({
    links: {
      GitHub: "https://github.com/jackyzha0/quartz",
      "Discord Community": "https://discord.gg/cRFFHYye7t",
    },
  }),
}

// components for pages that display a single page (e.g. a single note)
export const defaultContentPageLayout: PageLayout = {
  beforeBody: [
    Component.Breadcrumbs(),
    Component.ArticleTitle(),
    Component.ContentMeta(),
    Component.TagList(),
  ],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Search(),
    Component.Darkmode(),
    Component.DesktopOnly(
      Component.RecentNotes({ linkToMore: "tags/", limit: 4, showTags: false }),
    ),
    Component.DesktopOnly(Component.Explorer({ folderDefaultState: "open" })),
  ],
  right: [
    Component.MobileOnly(Component.RecentNotes({ linkToMore: "tags/", limit: 5, showTags: false })),
    Component.MobileOnly(Component.Explorer({ folderDefaultState: "open" })),
    Component.Graph(),
    Component.DesktopOnly(Component.TableOfContents()),
    Component.Backlinks(),
  ],
}

// components for pages that display lists of pages  (e.g. tags or folders)
export const defaultListPageLayout: PageLayout = {
  beforeBody: [Component.Breadcrumbs(), Component.ArticleTitle(), Component.ContentMeta()],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Search(),
    Component.Darkmode(),
    Component.DesktopOnly(
      Component.RecentNotes({ linkToMore: "tags/", limit: 5, showTags: false }),
    ),
    Component.DesktopOnly(Component.Explorer()),
  ],
  right: [
    Component.MobileOnly(Component.Spacer()),
    Component.MobileOnly(Component.Spacer()),
    Component.MobileOnly(Component.RecentNotes({ linkToMore: "tags/", limit: 3, showTags: false })),
    Component.MobileOnly(Component.Explorer({ folderDefaultState: "open" })),
  ],
}

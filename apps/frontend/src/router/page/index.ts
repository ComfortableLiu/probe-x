import dashboardRoutes from "./Dashboard"
import accountRoutes from "./Account"
import pointManageRoutes from "./PointManage"
import sataAnalysisRoutes from "./DataAnalysis"
import systemDataRoutes from "./SystemData"
import systemConfigRoutes from "./SystemConfig"
import guideRoutes from "./Guide"

// 看板页置于首位（菜单顺序紧随首页）
export default [
  dashboardRoutes,
  ...accountRoutes,
  pointManageRoutes,
  sataAnalysisRoutes,
  systemDataRoutes,
  systemConfigRoutes,
  guideRoutes,
]

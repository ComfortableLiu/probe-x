import accountRoutes from "./Account"
import pointManageRoutes from "./PointManage"
import sataAnalysisRoutes from "./DataAnalysis"
import systemDataRoutes from "./SystemData"
import systemConfigRoutes from "./SystemConfig"
import guideRoutes from "./Guide"

export default [
  ...accountRoutes,
  pointManageRoutes,
  sataAnalysisRoutes,
  systemDataRoutes,
  systemConfigRoutes,
  guideRoutes,
]

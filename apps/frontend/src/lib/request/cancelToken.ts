import type { CancelTokenSource } from 'axios'

class Cancel {
  static queen: CancelTokenSource[] = []
  static add(item: CancelTokenSource) {
    this.queen.push(item)
  }
  static cancel() {
    // this.queen.forEach((item) => {
    //   item.cancel();
    // });
    this.clean()
  }

  static clean() {
    this.queen = new Array<CancelTokenSource>()
  }
}

export default Cancel

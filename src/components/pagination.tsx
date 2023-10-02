export default function Pagination(props: {
  page: number,
  totalCount?: number,
  pageSize: number
  onChange: (page: number) => void,
}) {
  if (props.totalCount === 0) return null
  const lastPage = props.totalCount ? Math.floor(props.totalCount/props.pageSize)+(props.totalCount%props.pageSize === 0 ? 0 : 1) : Infinity
  return (
    <div className="join">
      {props.page > 2 ? <button className="join-item btn" onClick={() => {props.onChange(1)}}>{1}</button> : null}
      {props.page > 3 ? <button className="join-item btn btn-disabled">...</button> : null}
      {props.page > 1 ? <button className="join-item btn" onClick={() => {props.onChange(props.page-1)}}>{props.page-1}</button> : null}
      <button className="join-item btn btn-active">{props.page}</button>
      {props.page < lastPage-1 ? <button className="join-item btn" onClick={() => {props.onChange(props.page+1)}}>{props.page+1}</button> : null}
      {props.page < lastPage-2 ? <button className="join-item btn btn-disabled">...</button> : null}
      {props.totalCount !== undefined && props.page < lastPage ? <button className="join-item btn" onClick={() => {props.onChange(lastPage)}}>{lastPage}</button> : null}
    </div>
  )
}
